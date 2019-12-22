import os
from os.path import join, dirname
from vunit import VUnit
import subprocess

root = dirname(__file__)

vu = VUnit.from_argv()

testlib = vu.add_library("testlib")
testlib.add_source_files(join(root, "vhdl/tb_test0.vhd"))
testlib.add_source_files(join(root, "vhdl/tb_test1.vhd"))
testlib.test_bench("tb_test1").test("test1").add_config("conf2")

testlib2 = vu.add_library("testlib2")
testlib2.add_source_files(join(root, "vhdl/tb_test2.vhd"))
subprocess.run("vivado -version", shell=True)
print(os.getcwd())
vu.main()