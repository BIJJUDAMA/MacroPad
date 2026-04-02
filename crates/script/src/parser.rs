use crate::ast::*;
use crate::lexer::{LexError, Token};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ParseError {
    #[error("lex error: {0}")]
    Lex(#[from] LexError),
    #[error("line {line}: expected {expected}, got {got}")]
    Expected {
        line:     usize,
        expected: String,
        got:      String,
    },
    #[error("line {line}: {msg}")]
    Generic { line: usize, msg: String },
}

pub struct Parser {
    tokens: Vec<(Token, usize)>,
    pos:    usize,
}

impl Parser {
    pub fn new(tokens: Vec<(Token, usize)>) -> Self {
        Self { tokens, pos: 0 }
    }

    fn peek(&self) -> &Token {
        self.tokens.get(self.pos).map(|(t, _)| t).unwrap_or(&Token::Eof)
    }

    fn line(&self) -> usize {
        self.tokens.get(self.pos).map(|(_, l)| *l).unwrap_or(0)
    }

    fn advance(&mut self) -> &Token {
        let tok = self.tokens.get(self.pos).map(|(t, _)| t).unwrap_or(&Token::Eof);
        self.pos += 1;
        tok
    }

    fn skip_newlines(&mut self) {
        while self.peek() == &Token::Newline {
            self.advance();
        }
    }

    fn expect(&mut self, expected: Token) -> Result<(), ParseError> {
        let line = self.line();
        let tok  = self.advance().clone();
        if tok == expected {
            Ok(())
        } else {
            Err(ParseError::Expected {
                line,
                expected: format!("{:?}", expected),
                got:      format!("{:?}", tok),
            })
        }
    }

    pub fn parse(&mut self) -> Result<Script, ParseError> {
        let mut statements = Vec::new();

        loop {
            self.skip_newlines();
            if self.peek() == &Token::Eof {
                break;
            }
            statements.push(self.parse_statement()?);
        }

        Ok(Script { statements })
    }

    fn parse_statement(&mut self) -> Result<Statement, ParseError> {
        let line = self.line();
        match self.peek().clone() {
            Token::Let       => self.parse_let(),
            Token::Run       => self.parse_run(false),
            Token::RunAsync  => self.parse_run(true),
            Token::If        => self.parse_if(),
            Token::Loop      => self.parse_loop(),
            Token::LoopWhile => self.parse_loop_while(),
            Token::WaitFor   => self.parse_wait_for(),
            Token::Delay     => self.parse_delay(),
            other => Err(ParseError::Generic {
                line,
                msg: format!("unexpected token: {:?}", other),
            }),
        }
    }

    fn parse_let(&mut self) -> Result<Statement, ParseError> {
        self.advance(); // consume `let`
        let name = match self.advance().clone() {
            Token::Ident(n) => if n.starts_with('$') { n[1..].to_string() } else { n },
            other => return Err(ParseError::Expected {
                line:     self.line(),
                expected: "identifier".into(),
                got:      format!("{:?}", other),
            }),
        };
        self.expect(Token::Equals)?;
        let value = self.parse_expr()?;
        Ok(Statement::Let { name, value })
    }

    fn parse_run(&mut self, is_async: bool) -> Result<Statement, ParseError> {
        self.advance(); // consume `run` or `run_async`
        let path = self.parse_expr()?;
        let mut args = Vec::new();

        // parse optional key=value args
        while matches!(self.peek(), Token::Ident(_)) {
            let key = match self.advance().clone() {
                Token::Ident(k) => k,
                _ => unreachable!(),
            };
            self.expect(Token::Equals)?;
            let value = self.parse_expr()?;
            args.push(RunArg { key, value });
        }

        Ok(Statement::Run { path, args, is_async })
    }

    fn parse_if(&mut self) -> Result<Statement, ParseError> {
        self.advance(); // consume `if`
        let condition = self.parse_condition()?;
        let body      = self.parse_block()?;

        let mut elif_branches = Vec::new();
        let mut else_body     = None;

        loop {
            self.skip_newlines();
            if self.peek() == &Token::Elif {
                self.advance();
                let cond  = self.parse_condition()?;
                let block = self.parse_block()?;
                elif_branches.push(ElifBranch { condition: cond, body: block });
            } else if self.peek() == &Token::Else {
                self.advance();
                else_body = Some(self.parse_block()?);
                break;
            } else {
                break;
            }
        }

        Ok(Statement::If { condition, body, elif_branches, else_body })
    }

    fn parse_loop(&mut self) -> Result<Statement, ParseError> {
        self.advance(); // consume `loop`
        self.expect(Token::LParen)?;
        let count = match self.advance().clone() {
            Token::Number(n) => n.parse::<u32>().unwrap_or(1),
            other => return Err(ParseError::Expected {
                line:     self.line(),
                expected: "number".into(),
                got:      format!("{:?}", other),
            }),
        };
        self.expect(Token::RParen)?;
        let body = self.parse_block()?;
        Ok(Statement::Loop { count, body })
    }

    fn parse_loop_while(&mut self) -> Result<Statement, ParseError> {
        self.advance(); // consume `loop_while`
        let condition = self.parse_condition()?;

        // optional max=N
        let mut max_iter = None;
        if matches!(self.peek(), Token::Ident(k) if k == "max") {
            self.advance();
            self.expect(Token::Equals)?;
            if let Token::Number(n) = self.advance().clone() {
                max_iter = n.parse::<u32>().ok();
            }
        }

        let body = self.parse_block()?;
        Ok(Statement::LoopWhile { condition, body, max_iter })
    }

    fn parse_wait_for(&mut self) -> Result<Statement, ParseError> {
        self.advance(); // consume `wait_for`
        let condition = self.parse_condition()?;

        // optional timeout=Xs or timeout=Xms
        let mut timeout_ms = 15000u64;
        if matches!(self.peek(), Token::Ident(k) if k == "timeout") {
            self.advance();
            self.expect(Token::Equals)?;
            if let Token::Number(n) = self.advance().clone() {
                timeout_ms = parse_duration_ms(&n);
            }
        }

        Ok(Statement::WaitFor { condition, timeout_ms })
    }

    fn parse_delay(&mut self) -> Result<Statement, ParseError> {
        self.advance(); // consume `delay`
        let ms = match self.advance().clone() {
            Token::Number(n) => parse_duration_ms(&n),
            other => return Err(ParseError::Expected {
                line:     self.line(),
                expected: "duration (e.g. 500ms)".into(),
                got:      format!("{:?}", other),
            }),
        };
        Ok(Statement::Delay { ms })
    }

    fn parse_block(&mut self) -> Result<Vec<Statement>, ParseError> {
        self.skip_newlines();
        self.expect(Token::LBrace)?;
        let mut stmts = Vec::new();

        loop {
            self.skip_newlines();
            if self.peek() == &Token::RBrace || self.peek() == &Token::Eof {
                break;
            }
            stmts.push(self.parse_statement()?);
        }

        self.expect(Token::RBrace)?;
        Ok(stmts)
    }

    fn parse_condition(&mut self) -> Result<Condition, ParseError> {
        let line = self.line();
        match self.advance().clone() {
            Token::Window | Token::WindowRe => {
                let use_regex = matches!(
                    self.tokens.get(self.pos - 1),
                    Some((Token::WindowRe, _))
                );
                self.expect(Token::LParen)?;
                let title = self.parse_expr()?;
                self.expect(Token::RParen)?;
                Ok(Condition::Window { title, use_regex })
            }

            Token::Pixel => {
                self.expect(Token::LParen)?;
                let x   = self.parse_i32()?;
                self.expect(Token::Comma)?;
                let y   = self.parse_i32()?;
                self.expect(Token::Comma)?;
                let hex = match self.advance().clone() {
                    Token::Ident(h) => format!("#{}", h),
                    Token::StringLit(h) => h,
                    other => return Err(ParseError::Expected {
                        line,
                        expected: "hex color".into(),
                        got:      format!("{:?}", other),
                    }),
                };
                // optional tolerance=N
                let mut tolerance = 0u32;
                if self.peek() == &Token::Comma {
                    self.advance();
                    if matches!(self.peek(), Token::Ident(k) if k == "tolerance") {
                        self.advance();
                        self.expect(Token::Equals)?;
                        if let Token::Number(n) = self.advance().clone() {
                            tolerance = n.parse().unwrap_or(0);
                        }
                    }
                }
                self.expect(Token::RParen)?;
                Ok(Condition::Pixel { x, y, hex, tolerance })
            }

            Token::MacroOk   => Ok(Condition::MacroOk),
            Token::MacroFail => Ok(Condition::MacroFail),
            Token::True      => Ok(Condition::True),
            Token::False     => Ok(Condition::False),

            other => Err(ParseError::Generic {
                line,
                msg: format!("expected condition, got {:?}", other),
            }),
        }
    }

    fn parse_expr(&mut self) -> Result<Expr, ParseError> {
        match self.peek().clone() {
            Token::StringLit(s) => {
                self.advance();
                Ok(parse_interpolated(&s))
            }
            Token::Ident(name) if name.starts_with('$') => {
                self.advance();
                Ok(Expr::Var(name[1..].to_string()))
            }
            Token::Ident(name) => {
                self.advance();
                Ok(Expr::Literal(name))
            }
            Token::Number(n) => {
                self.advance();
                Ok(Expr::Literal(n))
            }
            other => Err(ParseError::Expected {
                line:     self.line(),
                expected: "expression".into(),
                got:      format!("{:?}", other),
            }),
        }
    }

    fn parse_i32(&mut self) -> Result<i32, ParseError> {
        match self.advance().clone() {
            Token::Number(n) => n.parse::<i32>().map_err(|_| ParseError::Generic {
                line: self.line(),
                msg:  format!("'{}' is not a valid integer", n),
            }),
            other => Err(ParseError::Expected {
                line:     self.line(),
                expected: "integer".into(),
                got:      format!("{:?}", other),
            }),
        }
    }
}

fn parse_interpolated(s: &str) -> Expr {
    if !s.contains('$') {
        return Expr::Literal(s.to_string());
    }

    let mut parts  = Vec::new();
    let mut buf    = String::new();
    let mut chars  = s.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch == '$' {
            if !buf.is_empty() {
                parts.push(InterpolatedPart::Literal(buf.clone()));
                buf.clear();
            }
            let mut var = String::new();
            while matches!(chars.peek(), Some(c) if c.is_alphanumeric() || *c == '_') {
                var.push(chars.next().unwrap());
            }
            if !var.is_empty() {
                parts.push(InterpolatedPart::Var(var));
            }
        } else {
            buf.push(ch);
        }
    }

    if !buf.is_empty() {
        parts.push(InterpolatedPart::Literal(buf));
    }

    if parts.len() == 1 {
        if let InterpolatedPart::Literal(s) = &parts[0] {
            return Expr::Literal(s.clone());
        }
    }

    Expr::Interpolated(parts)
}

fn parse_duration_ms(s: &str) -> u64 {
    if s.ends_with("ms") {
        s.trim_end_matches("ms").parse().unwrap_or(0)
    } else if s.ends_with('s') {
        s.trim_end_matches('s').parse::<u64>().unwrap_or(0) * 1000
    } else {
        s.parse().unwrap_or(0)
    }
}