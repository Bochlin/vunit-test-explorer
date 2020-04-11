library vunit_lib;
context vunit_lib.vunit_context;

entity tb_test1 is
    generic (
        runner_cfg : string := runner_cfg_default;
        integer_param : integer := 0;
        boolean_param : boolean := false 
    );
end entity tb_test1;

architecture tb of tb_test1 is
begin
    main : process is
    begin
        test_runner_setup(runner, runner_cfg);
        if run("test1") then
            check(true);
        elsif run("test2") then
            check(false);
        elsif run("test3") then
            check(true);
        elsif run("testing.test4") then
            check(true);
        end if;
        test_runner_cleanup(runner);
    end process;
end architecture tb;