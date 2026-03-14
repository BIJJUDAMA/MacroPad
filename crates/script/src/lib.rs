pub mod ast;
pub mod lexer;
pub mod parser;
pub mod runner;
pub mod variables;

use parser::{ParseError, Parser};
use lexer::Lexer;
use runner::{Runner, RunnerError};
use variables::Scope;
use std::path::Path;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ScriptError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("parse error: {0}")]
    Parse(#[from] ParseError),
    #[error("runtime error: {0}")]
    Runtime(#[from] RunnerError),
}

pub async fn run_script(path: &Path, dry_run: bool) -> Result<(), ScriptError> {
    let source  = std::fs::read_to_string(path)?;
    let mut lexer  = Lexer::new(&source);
    let tokens  = lexer.tokenize().map_err(ParseError::Lex)?;
    let mut parser = Parser::new(tokens);
    let script  = parser.parse()?;
    let runner  = Runner::new(path, dry_run);
    let mut scope  = Scope::new();

    runner.run(&script, &mut scope).await?;
    Ok(())
}