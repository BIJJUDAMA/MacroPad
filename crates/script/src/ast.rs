#[derive(Debug, Clone)]
pub struct Script {
    pub statements: Vec<Statement>,
}

#[derive(Debug, Clone)]
pub enum Statement {
    Let {
        name: String,
        value: Expr,
    },
    Run {
        path: Expr,
        args: Vec<RunArg>,
        is_async: bool,
    },
    If {
        condition: Condition,
        body: Vec<Statement>,
        elif_branches: Vec<ElifBranch>,
        else_body: Option<Vec<Statement>>,
    },
    Loop {
        count: u32,
        body: Vec<Statement>,
    },
    LoopWhile {
        condition: Condition,
        body: Vec<Statement>,
        max_iter: Option<u32>,
    },
    WaitFor {
        condition: Condition,
        timeout_ms: u64,
    },
    Delay {
        ms: u64,
    },
}

#[derive(Debug, Clone)]
pub struct ElifBranch {
    pub condition: Condition,
    pub body: Vec<Statement>,
}

#[derive(Debug, Clone)]
pub struct RunArg {
    pub key: String,
    pub value: Expr,
}

// expressions — things that resolve to a string value at runtime
#[derive(Debug, Clone)]
pub enum Expr {
    Literal(String),
    Var(String),
    // "hello $name world" — stored as a list of parts
    Interpolated(Vec<InterpolatedPart>),
}

#[derive(Debug, Clone)]
pub enum InterpolatedPart {
    Literal(String),
    Var(String),
}

// conditions used in if / loop_while / wait_for
#[derive(Debug, Clone)]
pub enum Condition {
    Window {
        title: Expr,
        use_regex: bool,
    },
    Pixel {
        x: i32,
        y: i32,
        hex: String,
        tolerance: u32,
    },
    MacroOk,
    MacroFail,
    True,
    False,
}
