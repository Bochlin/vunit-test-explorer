import os
from os.path import join, dirname
from vunit import VUnit
import subprocess

root = dirname(__file__)

vu = VUnit.from_argv()

testlib = vu.add_library("testlib")
testlib.add_source_files(join(root, "vhdl/testlib/*.vhd"))
[testlib.test_bench("tb_test1").test("test1").add_config(f"conf{n}") for n in range(3)]
testlib.test_bench("tb_test1").add_config("tbconf")

testlib2 = vu.add_library("testlib2")
testlib2.add_source_files(join(root, "vhdl/testlib2/tb_test2.vhd"))
# subprocess.run("vivado -version", shell=True)
vu.main()