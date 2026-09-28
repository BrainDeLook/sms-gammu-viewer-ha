"""Network names supplied by the gateway take priority over MCC/MNC fallback."""
import ast
from pathlib import Path
import unittest

PATH = Path(__file__).parents[1] / "custom_components" / "sms_gammu_viewer" / "gateway.py"
TREE = ast.parse(PATH.read_text(encoding="utf-8"))
NODES = [node for node in TREE.body if isinstance(node, ast.Assign)
         and any(isinstance(target, ast.Name) and target.id == "_NETWORK_NAMES_BY_CODE"
                 for target in node.targets)]
NODES += [node for node in TREE.body if getattr(node, "name", None) == "_network_with_code_fallback"]
NAMESPACE = {}
exec(compile(ast.Module(body=NODES, type_ignores=[]), str(PATH), "exec"), NAMESPACE)
normalize = NAMESPACE["_network_with_code_fallback"]


class NetworkFallbackTests(unittest.TestCase):
    def test_beeline_code_fills_missing_network_name(self):
        for missing in (None, "", "unknown", "Unknown"):
            with self.subTest(missing=missing):
                payload = {"NetworkName": missing, "NetworkCode": "250 99"}
                result = normalize(payload)
                self.assertEqual(result["NetworkName"], "Beeline")
                self.assertEqual(payload["NetworkName"], missing)

    def test_real_modem_name_remains_authoritative(self):
        payload = {"NetworkName": "VimpelCom", "NetworkCode": "250 99"}
        self.assertIs(normalize(payload), payload)

    def test_other_codes_are_not_misidentified(self):
        payload = {"NetworkName": None, "NetworkCode": "250 01"}
        self.assertIs(normalize(payload), payload)

    def test_compact_code_and_lowercase_fields(self):
        self.assertEqual(normalize({"network_code": "25099"})["NetworkName"], "Beeline")


class GatewayNetworkTests(unittest.IsolatedAsyncioTestCase):
    async def test_get_network_normalizes_lean_and_legacy_responses(self):
        gateway_class = next(node for node in TREE.body if getattr(node, "name", None) == "GatewayClient")
        gateway_class.body = [node for node in gateway_class.body
                              if getattr(node, "name", None) == "get_network"]
        namespace = dict(NAMESPACE)
        exec(compile(ast.Module(body=[gateway_class], type_ignores=[]), str(PATH), "exec"), namespace)
        gateway = namespace["GatewayClient"]()

        async def lean_status():
            return {"network": {"NetworkName": None, "NetworkCode": "250 99"}}

        gateway._get_lean_status = lean_status
        self.assertEqual((await gateway.get_network())["NetworkName"], "Beeline")

        async def no_lean_status():
            return None

        async def legacy_request(method, path):
            self.assertEqual((method, path), ("GET", "/status/network"))
            return {"NetworkCode": "25099"}

        gateway._get_lean_status = no_lean_status
        gateway._request = legacy_request
        self.assertEqual((await gateway.get_network())["NetworkName"], "Beeline")


if __name__ == "__main__":
    unittest.main()
