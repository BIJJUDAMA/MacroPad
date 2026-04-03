use script::lexer::{Lexer, Token};
use script::parser::Parser;
use script::runner::Runner;
use script::variables::Scope;
use std::path::Path;

#[tokio::test]
async fn test_script_logic_flow() {
    // Current language only supports MacroOk, MacroFail, True, False, Window, Pixel as conditions
    let source = r#"
        let $val = "initial"
        if true {
            let $val = "inside_if"
        }
    "#;

    let mut lexer = Lexer::new(source);
    let tokens = lexer.tokenize().expect("Lexing failed");
    let mut parser = Parser::new(tokens);
    let script = parser.parse().expect("Parsing failed");

    let runner = Runner::new(Path::new("test.mps"), true); // dry_run = true
    let mut scope = Scope::new();

    runner
        .run(&script, &mut scope)
        .await
        .expect("Execution failed");

    assert_eq!(scope.get("val"), Some("inside_if"));
}

#[tokio::test]
async fn test_script_loop_iteration() {
    let source = r#"
        loop (5) {
            delay 10
        }
    "#;

    let mut lexer = Lexer::new(source);
    let tokens = lexer.tokenize().unwrap();
    let mut parser = Parser::new(tokens);
    let script = parser.parse().unwrap();

    let runner = Runner::new(Path::new("test.mps"), true);
    let mut scope = Scope::new();

    runner.run(&script, &mut scope).await.unwrap();
    // Verify that it completed without error
}

#[tokio::test]
async fn test_windows_path_lexing() {
    let source = r#"run "C:\Users\test\macro.mpr""#;
    let mut lexer = Lexer::new(source);
    let tokens = lexer.tokenize().unwrap();

    // Token 0: RUN
    // Token 1: StringLit("C:\Users\test\macro.mpr")
    match &tokens[1].0 {
        Token::StringLit(s) => {
            assert_eq!(s, r"C:\Users\test\macro.mpr");
        }
        _ => panic!("Expected StringLit token"),
    }
}

#[test]
fn test_invalid_syntax_detection() {
    let source = "let $missing_equals 10";
    let mut lexer = Lexer::new(source);
    let tokens = lexer.tokenize().unwrap();
    let mut parser = Parser::new(tokens);

    assert!(parser.parse().is_err());
}
