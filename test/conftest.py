import sys
import types

# Provide a minimal stub of the requests module so the script can be imported
if "requests" not in sys.modules:
    requests_stub = types.ModuleType("requests")
    requests_stub.RequestException = Exception

    def _missing(*_, **__):
        raise NotImplementedError

    requests_stub.get = _missing
    sys.modules["requests"] = requests_stub
