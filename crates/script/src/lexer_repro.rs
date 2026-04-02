use crate::lexer::*;

#[test]
fn test_user_path_repro() {
    let source = r#"run "C:\Users\nitan\Downloads\Macro\test.mpr""#;
    let mut lexer = Lexer::new(source);
    match lexer.tokenize() {
        Ok(tokens) => {
            // Should be: Run, StringLit, Eof
            assert_eq!(tokens.len(), 3);
            assert_eq!(tokens[0].0, Token::Run);
            if let Token::StringLit(s) = &tokens[1].0 {
                assert_eq!(s, r"C:\Users\nitan\Downloads\Macro\test.mpr");
            } else {
                panic!("Expected string lit, got {:?}", tokens[1].0);
            }
        }
        Err(e) => panic!("Lexer error: {}", e),
    }
}
