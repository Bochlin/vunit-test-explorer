import os
from pathlib import Path
from vunit import VUnit

ROOT = Path(__file__).parent.parent

vu = VUnit.from_argv()

testlib = vu.add_library("testlib")
testlib.add_source_files(str(ROOT / "vhdl/testlib/*.vhd"))
[testlib.test_bench("tb_test1").test(
    "test1").add_config(f"conf{n}") for n in range(3)]
testlib.test_bench("tb_test1").add_config("tbconf")

testlib2 = vu.add_library("testlib2")
testlib2.add_source_files(str(ROOT / "vhdl/testlib2/tb_test2.vhd"))


vu.main()
