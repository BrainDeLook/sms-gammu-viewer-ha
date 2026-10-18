"""Exercise image delivery helpers without importing Home Assistant."""
import ast
import asyncio
from datetime import timedelta
import hashlib
import logging
from pathlib import Path
import re
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, Mock
from urllib.parse import quote

SOURCE = Path(__file__).parents[1] / "custom_components/sms_gammu_viewer/__init__.py"
TREE = ast.parse(SOURCE.read_text(encoding="utf-8"))


def load_helpers(config_dir):
    signer = Mock(side_effect=lambda hass, path, expiration, **kwargs: path + "?authSig=test")
    namespace = dict(Path=Path, hashlib=hashlib, timedelta=timedelta,
                     HomeAssistant=object, HomeAssistantView=object, re=re,
                     async_sign_path=signer, __file__=str(SOURCE), FRONTEND_PATH="frontend")
    helpers = {"_brand_asset_dir", "_brand_asset_id", "_bundled_brand_dir",
               "_signed_brand_asset_url", "_signed_brand_catalog",
               "_catalog_local_assets", "_bundled_png_source", "BrandAssetView"}
    # The view annotations need only stand-ins; the actual handler runs below.
    namespace["web"] = SimpleNamespace(Request=object, Response=lambda **kw: kw,
                                      HTTPNotFound=FileNotFoundError)
    module = ast.Module(body=[n for n in TREE.body if getattr(n, "name", "") in helpers], type_ignores=[])
    exec(compile(module, str(SOURCE), "exec"), namespace)
    hass = SimpleNamespace(config=SimpleNamespace(config_dir=config_dir))
    hass.async_add_executor_job = lambda fn, *args: asyncio.to_thread(fn, *args)
    return namespace, signer, hass


class BrandAssetsTests(unittest.IsolatedAsyncioTestCase):
    async def test_private_view_reads_via_executor_and_rejects_invalid_paths(self):
        with tempfile.TemporaryDirectory() as directory:
            ns, _, hass = load_helpers(directory)
            view = ns["BrandAssetView"](hass)
            self.assertTrue(view.requires_auth)
            asset_dir = ns["_brand_asset_dir"](hass)
            asset_dir.mkdir(parents=True)
            asset_id = "a" * 64
            (asset_dir / asset_id).write_bytes(b"\x89PNG\r\nimage")
            response = await view.get(None, asset_id + ".png")
            self.assertEqual(response["content_type"], "image/png")
            self.assertEqual(response["headers"]["Cache-Control"], "private, no-store")
            for invalid in ("../secret", "b" * 64, asset_id + ".svg"):
                with self.assertRaises(FileNotFoundError):
                    await view.get(None, invalid)

    async def test_catalog_signatures_are_temporary_and_do_not_modify_cache(self):
        ns, signer, hass = load_helpers("unused")
        catalog = {"logos": [{"localUrl": "/api/sms_gammu_viewer_brand/" + "a" * 64}, {"localFile": "svg/public.svg"}]}
        response = ns["_signed_brand_catalog"](hass, catalog)
        self.assertIn("?authSig=", response["logos"][0]["localUrl"])
        self.assertNotIn("?authSig=", catalog["logos"][0]["localUrl"])
        self.assertEqual(response["logos"][1], catalog["logos"][1])
        self.assertEqual(signer.call_args.args[2], timedelta(days=7))
        self.assertTrue(signer.call_args.kwargs["use_content_user"])

    async def test_catalog_discovers_only_existing_assets_in_executor(self):
        with tempfile.TemporaryDirectory() as directory:
            ns, _, hass = load_helpers(directory)
            source = "https://trace-logos.ru/assets/logos/test.svg"
            asset_dir = ns["_brand_asset_dir"](hass)
            asset_dir.mkdir(parents=True)
            (asset_dir / ns["_brand_asset_id"](source)).write_bytes(b"svg")
            logos = [{"svgUrl": source}, {"pngUrl": "https://trace-logos.ru/assets/logos/missing.png", "localUrl": "stale"}]
            result = await hass.async_add_executor_job(ns["_catalog_local_assets"], hass, logos)
            self.assertIn("localUrl", result[0])
            self.assertNotIn("localUrl", result[1])
            self.assertNotIn("localUrl", logos[0])

    async def test_mobile_attachment_is_signed_but_chat_link_is_unchanged(self):
        ns, signer, hass = load_helpers("unused")
        coordinator = next(n for n in TREE.body if isinstance(n, ast.ClassDef) and n.name == "SmsCoordinator")
        notify = next(n for n in coordinator.body if getattr(n, "name", "") == "_notify")
        ns.update(quote=quote, CONF_LANGUAGE="language", DEFAULT_LANGUAGE="ru",
                  NOTIFY_ACTION_REPLY_PREFIX="reply_", NOTIFY_ACTION_READ_PREFIX="read_",
                  _LOGGER=logging.getLogger(__name__))
        exec(compile(ast.Module(body=[notify], type_ignores=[]), str(SOURCE), "exec"), ns)
        hass.services = SimpleNamespace(async_call=AsyncMock())
        image = {"url": "/api/sms_gammu_viewer_brand/" + "a" * 64 + ".png", "content_type": "image/png"}
        coord = SimpleNamespace(
            hass=hass, entry=SimpleNamespace(data={}),
            _notify_targets=["notify.mobile_app_iphone", "notify.other"],
            store=SimpleNamespace(is_muted=lambda _: False, get_contact=lambda _: None,
                                  _display_sender_name=lambda name: name),
            _notification_brand_image=AsyncMock(return_value=image),
        )
        await ns["_notify"](coord, "+79991234567", "Test")
        mobile_data = hass.services.async_call.call_args_list[0].args[2]["data"]
        self.assertEqual(mobile_data["attachment"], {"url": image["url"] + "?authSig=test", "content-type": "png"})
        self.assertEqual(mobile_data["url"], "/sms-viewer?chat=%2B79991234567")
        self.assertNotIn("attachment", hass.services.async_call.call_args_list[1].args[2]["data"])
        signer.assert_called_once()

    async def test_no_direct_file_metadata_calls_in_async_functions(self):
        class Check(ast.NodeVisitor):
            def visit_Lambda(self, node):
                pass  # Deferred executor callbacks are not executed inline.

            def visit_FunctionDef(self, node):
                pass

            def visit_Call(self, node):
                if isinstance(node.func, ast.Attribute) and node.func.attr in {"is_file", "stat", "resolve"}:
                    raise AssertionError(f"Blocking metadata call at line {node.lineno}")
                self.generic_visit(node)

        for node in ast.walk(TREE):
            if isinstance(node, ast.AsyncFunctionDef):
                for statement in node.body:
                    Check().visit(statement)
