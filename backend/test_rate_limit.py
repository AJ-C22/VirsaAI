"""Auth and upload limits trip after the allowed number of hits."""
from rate_limit import allow, reset_limits


def test_limit_blocks_the_next_call():
    reset_limits()
    assert allow("login:test", 2) is True
    assert allow("login:test", 2) is True
    assert allow("login:test", 2) is False
    assert allow("other:test", 2) is True
    reset_limits()


if __name__ == "__main__":
    test_limit_blocks_the_next_call()
    print("ok rate limit")
