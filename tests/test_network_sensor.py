"""Exercise real coordinator/sensor methods without a Home Assistant install."""
import ast
import asyncio
import logging
from pathlib import Path
from types import SimpleNamespace
import unittest

ROOT = Path(__file__).parents[1] / "custom_components" / "sms_gammu_viewer"


def load_nodes(filename, names, namespace):
    tree = ast.parse((ROOT / filename).read_text(encoding="utf-8"))
    selected = [node for node in tree.body if getattr(node, "name", None) in names]
    exec(compile(ast.Module(body=selected, type_ignores=[]), filename, "exec"), namespace)


class FakeEntity:
    def async_write_ha_state(self):
        self.states.append(self.native_value)

    def async_on_remove(self, callback):
        self.removers.append(callback)


class NetworkSensorTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.namespace = {
            "SensorEntity": FakeEntity, "HomeAssistant": object,
            "ConfigEntry": object, "DOMAIN": "sms_gammu_viewer",
            "callback": lambda fn: fn, "SCAN_INTERVAL": None,
            "async_track_time_interval": lambda *args: lambda: None,
        }
        self.namespace["_NETWORK_KEYS"] = (
            "NetworkName", "network_name", "Operator", "operator",
            "Carrier", "carrier", "Provider", "provider",
        )
        load_nodes("sensor.py", {"_status_value", "_network_value", "_BaseSmsSensor", "SmsNetworkSensor"}, self.namespace)
        tree = ast.parse((ROOT / "__init__.py").read_text(encoding="utf-8"))
        cls = next(node for node in tree.body if getattr(node, "name", None) == "SmsCoordinator")
        cls.body = [node for node in cls.body if getattr(node, "name", None) in {
            "status_cache", "register_status_listener", "unregister_status_listener",
            "refresh_status_cache",
        }]
        self.namespace.update(asyncio=asyncio, _LOGGER=logging.getLogger(__name__),
                              CONF_CALL_DEVICE="call_device", CONF_LANGUAGE="language",
                              DEFAULT_LANGUAGE="ru", CONF_SHOW_PANEL="show_panel",
                              DEFAULT_SHOW_PANEL=True, CONF_USE_BRAND_LOGOS="use_brand_logos",
                              DEFAULT_USE_BRAND_LOGOS=True)
        exec(compile(ast.Module(body=[cls], type_ignores=[]), "__init__.py", "exec"), self.namespace)
        self.coord = self.namespace["SmsCoordinator"]()
        self.coord._status_cache = None
        self.coord._status_listeners = []
        self.coord.entry = SimpleNamespace(data={})
        self.network = {"NetworkName": "Beeline"}

        async def network():
            if isinstance(self.network, Exception):
                raise self.network
            return self.network

        async def other():
            return {}

        self.coord.client = SimpleNamespace(get_network=network, get_signal=other,
                                           get_modem=other, get_sim=other, get_sms_capacity=other)
        hass = SimpleNamespace(data={"sms_gammu_viewer": {"entry": self.coord}})
        self.sensor = self.namespace["SmsNetworkSensor"](hass, SimpleNamespace(entry_id="entry"))
        self.sensor.states = []
        self.sensor.removers = []
        await self.sensor.async_added_to_hass()

    async def test_cold_start_updates_immediately_when_cache_arrives(self):
        self.assertIsNone(self.sensor.native_value)
        await self.coord.refresh_status_cache()
        self.assertEqual(self.sensor.states[-1], "Beeline")
        self.network = {"NetworkName": "MTS"}
        await self.coord.refresh_status_cache()
        self.assertEqual(self.sensor.states[-1], "MTS")

    async def test_transient_failure_keeps_last_operator_and_recovers(self):
        await self.coord.refresh_status_cache()
        self.network = TimeoutError("gateway timeout")
        await self.coord.refresh_status_cache()
        self.assertEqual(self.sensor.native_value, "Beeline")
        self.network = {"NetworkName": "t2"}
        await self.coord.refresh_status_cache()
        self.assertEqual(self.sensor.native_value, "t2")
        self.network = {"NetworkName": ""}
        await self.coord.refresh_status_cache()
        self.assertIsNone(self.sensor.native_value)

    async def test_unload_removes_subscription(self):
        for remove in self.sensor.removers:
            remove()
        self.assertEqual(self.coord._status_listeners, [])

    async def test_nested_network_and_modem_fallback(self):
        self.network = {"registration": {"carrier": "Beeline"}}
        await self.coord.refresh_status_cache()
        self.assertEqual(self.sensor.native_value, "Beeline")
        self.assertEqual(self.sensor.extra_state_attributes["operator_source"], "network")
        self.network = None

        async def modem():
            return {"NetworkName": "MTS", "Model": "Huawei"}

        self.coord.client.get_modem = modem
        await self.coord.refresh_status_cache()
        self.assertEqual(self.sensor.native_value, "MTS")
        self.assertEqual(self.sensor.extra_state_attributes["operator_source"], "modem")


if __name__ == "__main__":
    unittest.main()
