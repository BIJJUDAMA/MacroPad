use chrono::Local;
use std::collections::HashMap;

pub struct Scope {
    vars: HashMap<String, String>,
}

impl Scope {
    pub fn new() -> Self {
        let mut vars = HashMap::new();

        // built-in variables
        let now = Local::now();
        vars.insert("date".into(), now.format("%Y-%m-%d").to_string());
        vars.insert("time".into(), now.format("%H:%M:%S").to_string());
        vars.insert(
            "datetime".into(),
            now.format("%Y-%m-%d %H:%M:%S").to_string(),
        );
        vars.insert("username".into(), whoami());
        vars.insert("home".into(), home_dir());

        Self { vars }
    }

    pub fn set(&mut self, name: &str, value: &str) {
        self.vars.insert(name.to_string(), value.to_string());
    }

    pub fn get(&self, name: &str) -> Option<&str> {
        self.vars.get(name).map(|s| s.as_str())
    }

    pub fn set_last_result(&mut self, ok: bool) {
        self.vars.insert(
            "last_result".into(),
            if ok { "ok".into() } else { "fail".into() },
        );
    }

    pub fn resolve_expr(&self, expr: &crate::ast::Expr) -> String {
        use crate::ast::{Expr, InterpolatedPart};
        match expr {
            Expr::Literal(s) => s.clone(),
            Expr::Var(name) => self.get(name).unwrap_or("").to_string(),
            Expr::Interpolated(parts) => parts
                .iter()
                .map(|part| match part {
                    InterpolatedPart::Literal(s) => s.clone(),
                    InterpolatedPart::Var(name) => self.get(name).unwrap_or("").to_string(),
                })
                .collect(),
        }
    }
}

impl Default for Scope {
    fn default() -> Self {
        Self::new()
    }
}

fn whoami() -> String {
    std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER"))
        .unwrap_or_else(|_| "unknown".into())
}

fn home_dir() -> String {
    std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".into())
}
