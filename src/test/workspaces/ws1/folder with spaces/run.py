import os
from pathlib import Path
from vunit import VUnitCLI, VUnit

ROOT = Path(__file__).parent.parent

cli = VUnitCLI()
cli.parser.add_argument('--testlib2', action='store_true')
args = cli.parse_args()
vu = VUnit.from_args(args=args)


testlib = vu.add_library("testlib")
testlib.add_source_files(str(ROOT / "vhdl/testlib/*.vhd"))
[testlib.test_bench("tb_test1").test(
    "test1").add_config(f"conf{n}") for n in range(3)]
testlib.test_bench("tb_test1").add_config("tbconf")

if args.testlib2:
    testlib2 = vu.add_library("testlib2")
    testlib2.add_source_files(str(ROOT / "vhdl/testlib2/tb_test2.vhd"))


vu.main()
