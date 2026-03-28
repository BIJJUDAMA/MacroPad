use thiserror::Error;

#[derive(Debug, Clone, PartialEq)]
pub enum Token {
    // keywords
    Let,
    Run,
    RunAsync,
    If,
    Elif,
    Else,
    Loop,
    LoopWhile,
    WaitFor,
    Delay,

    // condition keywords
    Window,
    WindowRe,
    Pixel,
    MacroOk,
    MacroFail,
    True,
    False,

    // symbols
    Equals,
    LBrace,
    RBrace,
    LParen,
    RParen,
    Comma,
    Semicolon,

    // literals
    Ident(String),
    StringLit(String),
    Number(String),

    // special
    Newline,
    Eof,
}

#[derive(Debug, Error)]
pub enum LexError {
    #[error("line {line}: unexpected character '{ch}'")]
    UnexpectedChar { line: usize, ch: char },
    #[error("line {line}: unterminated string")]
    UnterminatedString { line: usize },
}

pub struct Lexer {
    chars:  Vec<char>,
    pos:    usize,
    pub line: usize,
}

impl Lexer {
    pub fn new(source: &str) -> Self {
        Self {
            chars: source.chars().collect(),
            pos:   0,
            line:  1,
        }
    }

    fn peek(&self) -> Option<char> {
        self.chars.get(self.pos).copied()
    }

    fn advance(&mut self) -> Option<char> {
        let ch = self.chars.get(self.pos).copied();
        self.pos += 1;
        ch
    }

    fn skip_whitespace_inline(&mut self) {
        while matches!(self.peek(), Some(' ') | Some('\t')) {
            self.advance();
        }
    }

    fn read_string(&mut self) -> Result<String, LexError> {
        let start_line = self.line;
        let mut s = String::new();

        loop {
            match self.advance() {
                None | Some('\n') => {
                    return Err(LexError::UnterminatedString { line: start_line })
                }
                Some('"') => break,
                Some(ch)  => s.push(ch),
            }
        }

        Ok(s)
    }

    fn read_ident(&mut self, first: char) -> String {
        let mut s = String::from(first);
        while matches!(self.peek(), Some(c) if c.is_alphanumeric() || c == '_' || c == '-' || c == '$') {
            s.push(self.advance().unwrap());
        }
        s
    }

    fn read_number(&mut self, first: char) -> String {
        let mut s = String::from(first);
        while matches!(self.peek(), Some(c) if c.is_ascii_digit() || c == '.') {
            s.push(self.advance().unwrap());
        }
        // consume trailing 'ms' or 's' unit
        if matches!(self.peek(), Some('m')) {
            s.push(self.advance().unwrap());
            if matches!(self.peek(), Some('s')) {
                s.push(self.advance().unwrap());
            }
        } else if matches!(self.peek(), Some('s')) {
            s.push(self.advance().unwrap());
        }
        s
    }

    pub fn tokenize(&mut self) -> Result<Vec<(Token, usize)>, LexError> {
        let mut tokens = Vec::new();

        loop {
            self.skip_whitespace_inline();

            match self.peek() {
                None => {
                    tokens.push((Token::Eof, self.line));
                    break;
                }

                Some('#') => {
                    // comment — consume to end of line
                    while !matches!(self.peek(), None | Some('\n')) {
                        self.advance();
                    }
                }

                Some('\n') => {
                    self.advance();
                    self.line += 1;
                    tokens.push((Token::Newline, self.line));
                }

                Some('\r') => {
                    self.advance();
                }

                Some('"') => {
                    self.advance();
                    let s = self.read_string()?;
                    tokens.push((Token::StringLit(s), self.line));
                }

                Some('=') => {
                    self.advance();
                    tokens.push((Token::Equals, self.line));
                }
                Some('{') => { self.advance(); tokens.push((Token::LBrace,    self.line)); }
                Some('}') => { self.advance(); tokens.push((Token::RBrace,    self.line)); }
                Some('(') => { self.advance(); tokens.push((Token::LParen,    self.line)); }
                Some(')') => { self.advance(); tokens.push((Token::RParen,    self.line)); }
                Some(',') => { self.advance(); tokens.push((Token::Comma,     self.line)); }
                Some(';') => { self.advance(); tokens.push((Token::Semicolon, self.line)); }

                Some(c) if c.is_ascii_digit() => {
                    let ch = self.advance().unwrap();
                    let n  = self.read_number(ch);
                    tokens.push((Token::Number(n), self.line));
                }

                Some(c) if c.is_alphabetic() || c == '_' || c == '$' => {
                    let ch    = self.advance().unwrap();
                    let ident = self.read_ident(ch);

                    let tok = match ident.as_str() {
                        "let"        => Token::Let,
                        "run"        => Token::Run,
                        "run_async"  => Token::RunAsync,
                        "if"         => Token::If,
                        "elif"       => Token::Elif,
                        "else"       => Token::Else,
                        "loop"       => Token::Loop,
                        "loop_while" => Token::LoopWhile,
                        "wait_for"   => Token::WaitFor,
                        "delay"      => Token::Delay,
                        "window"     => Token::Window,
                        "window_re"  => Token::WindowRe,
                        "pixel"      => Token::Pixel,
                        "macro_ok"   => Token::MacroOk,
                        "macro_fail" => Token::MacroFail,
                        "true"       => Token::True,
                        "false"      => Token::False,
                        _            => Token::Ident(ident),
                    };

                    tokens.push((tok, self.line));
                }

                Some(ch) => {
                    return Err(LexError::UnexpectedChar { line: self.line, ch });
                }
            }
        }

        Ok(tokens)
    }
}