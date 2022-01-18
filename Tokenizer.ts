type Whitespace = ' ' | '\t' | '\n' | '\r';

export type TokenType =
| 'SOF' | 'EOF' // Things internal to the parser
| '<' | '=' | '>' | '</' | '/>'
| 'TagName' | 'AttributeName' | 'AttributeValue' | 'TextNode'
| 'Whitespace' | 'Comment' | 'Doctype' | 'XMLDeclaration'; // Things discarded by the parser
export type Token<type extends TokenType = TokenType, literal extends string = string> = { type: type; literal: literal };

type TokenizerState<tokens extends Token[], currentToken extends Token, restOfInput extends string> = {
    tokens: tokens;
    currentToken: currentToken;
    restOfInput: restOfInput;
};
type TokenizerStateDefault = TokenizerState<Token[], Token, string>; // Do this instead of using default type parameters so we still have to fill all of them out when constructing one

/* INPUT-PARSING OPERATIONS */
type Peek<state extends TokenizerStateDefault> = state['restOfInput'] extends `${infer first}${string}` ? first : '';
type PeekAfterAttributeDelimiter<state extends TokenizerStateDefault> = state['restOfInput'] extends `${string}${infer second}${string}` ? second : '';
type PeekAfterCloseComment<state extends TokenizerStateDefault> = state['restOfInput'] extends `-->${infer fourth}${string}` ? fourth : '';
type PeekAfterCloseDeclaration<state extends TokenizerStateDefault> = state['restOfInput'] extends `>${infer second}${string}` ? second : '';
type PeekLength2<state extends TokenizerStateDefault> = state['restOfInput'] extends `${infer first}${infer second}${string}` ? `${first}${second}` : '';
type PeekLength3<state extends TokenizerStateDefault> = state['restOfInput'] extends `${infer first}${infer second}${infer third}${string}` ? `${first}${second}${third}` : '';
type Rest<state extends TokenizerStateDefault> = state['restOfInput'] extends `${string}${infer rest}` ? rest : '';
type Rest2<state extends TokenizerStateDefault> = state['restOfInput'] extends `${string}${string}${infer rest}` ? rest : '';
type RestAfterCloseComment<state extends TokenizerStateDefault> = state['restOfInput'] extends `-->${string}${infer rest}` ? rest : '';
type RestAfterCloseDeclaration<state extends TokenizerStateDefault> = state['restOfInput'] extends `>${string}${infer rest}` ? rest : '';
type Delimiter<token extends Token> = token['literal'] extends `${infer first}${string}` ? first : '';

/* OUTPUT-GENERATING OPERATIONS */
type StartToken<newTokenType extends TokenType, state extends TokenizerStateDefault> = TokenizeStep<TokenizerState<[...state['tokens'], state['currentToken']], Token<newTokenType, Peek<state>>, Rest<state>>>;
type ContinueToken<state extends TokenizerStateDefault> = TokenizeStep<TokenizerState<state['tokens'], Token<state['currentToken']['type'], `${state['currentToken']['literal']}${Peek<state>}`>, Rest<state>>>;
// Like "StartToken" but drops the current token from the output
type DropTokenAndStart<newTokenType extends TokenType, state extends TokenizerStateDefault> = TokenizeStep<TokenizerState<state['tokens'], Token<newTokenType, Peek<state>>, Rest<state>>>;
// Like "StartToken" but handles an extra delimiter character
type DelimitAttributeValueAndStart<newTokenType extends TokenType, state extends TokenizerStateDefault> = TokenizeStep<TokenizerState<[...state['tokens'], Token<state['currentToken']['type'], `${state['currentToken']['literal']}${Peek<state>}`>], Token<newTokenType, PeekAfterAttributeDelimiter<state>>, Rest2<state>>>;
// Like "DropTokenAndStart" but handles an extra --> sequence
type DropCommentAndStart<newTokenType extends TokenType, state extends TokenizerStateDefault> = TokenizeStep<TokenizerState<state['tokens'], Token<newTokenType, PeekAfterCloseComment<state>>, RestAfterCloseComment<state>>>;
// Like "DropTokenAndStart" but handles an extra > character
type DropDeclarationAndStart<newTokenType extends TokenType, state extends TokenizerStateDefault> = TokenizeStep<TokenizerState<state['tokens'], Token<newTokenType, PeekAfterCloseDeclaration<state>>, RestAfterCloseDeclaration<state>>>;
// Like "ContinueToken but changes the current token's type"
type ChangeTokenTypeAndContinue<newTokenType extends TokenType, state extends TokenizerStateDefault> = TokenizeStep<TokenizerState<state['tokens'], Token<newTokenType, `${state['currentToken']['literal']}${Peek<state>}`>, Rest<state>>>;

/* ERROR HANDLING */
type TokenizationError<state extends TokenizerStateDefault, err extends string> = `TokenizationError: ${err}`;
type UnexpectedChar<state extends TokenizerStateDefault> =
    state['restOfInput'] extends ''
    ? TokenizationError<state, `Unexpected end of input after ${state['currentToken']['type']} (at '${state['currentToken']['literal']}')`>
    : TokenizationError<state, `Unexpected character '${Peek<state>}' after ${state['currentToken']['type']} (at '${state['currentToken']['literal']}')`>;

type TokenizeStep<state extends TokenizerStateDefault> =
    state['currentToken']['type'] extends 'SOF' ? (
        Peek<state> extends '<' ? DropTokenAndStart<'<', state>
        : Peek<state> extends '' ? DropTokenAndStart<'EOF', state>
        : DropTokenAndStart<'TextNode', state>)
    : state['currentToken']['type'] extends 'EOF' ? [...state['tokens'], state['currentToken']] // We had a successful parse! Nothing to do but spit out the output
    : state['currentToken']['type'] extends '<' ? (
        Peek<state> extends '' | Whitespace ? UnexpectedChar<state>
        : Peek<state> extends '/' ? ChangeTokenTypeAndContinue<'</', state>
        : PeekLength3<state> extends '!--' ? ChangeTokenTypeAndContinue<'Comment', state> // Must come before `<!` ::= Doctype
        : Peek<state> extends '!' ? ChangeTokenTypeAndContinue<'Doctype', state>
        : Peek<state> extends '?' ? ChangeTokenTypeAndContinue<'XMLDeclaration', state>
        : StartToken<'TagName', state>)
    : state['currentToken']['type'] extends '>' ? (
        Peek<state> extends '' ? StartToken<'EOF', state>
        : Peek<state> extends '<' ? StartToken<'<', state>
        : StartToken<'TextNode', state>)
    : state['currentToken']['type'] extends '/>' ? (
        Peek<state> extends '>' ? ContinueToken<state>
        : Peek<state> extends '' ? StartToken<'EOF', state>
        : Peek<state> extends '<' ? StartToken<'<', state>
        : StartToken<'TextNode', state>)
    : state['currentToken']['type'] extends '</' ? (
        Peek<state> extends '/' ? ContinueToken<state>
        : Peek<state> extends '' | Whitespace ? UnexpectedChar<state>
        : Peek<state> extends '<' ? StartToken<'<', state>
        : StartToken<'TagName', state>)
    : state['currentToken']['type'] extends 'TagName' ? (
        Peek<state> extends '' ? UnexpectedChar<state>
        : Peek<state> extends '>' ? StartToken<'>', state>
        : PeekLength2<state> extends '/>' ? StartToken<'/>', state>
        : Peek<state> extends Whitespace ? StartToken<'Whitespace', state>
        : ContinueToken<state>)
    : state['currentToken']['type'] extends 'Whitespace' ? (
        Peek<state> extends '' ? UnexpectedChar<state>
        : Peek<state> extends Whitespace ? ContinueToken<state>
        : Peek<state> extends '>' ? DropTokenAndStart<'>', state>
        : PeekLength2<state> extends '/>' ? DropTokenAndStart<'/>', state>
        : DropTokenAndStart<'AttributeName', state>)
    : state['currentToken']['type'] extends 'AttributeName' ? (
        Peek<state> extends '' | Whitespace ? UnexpectedChar<state>
        : Peek<state> extends '=' ? StartToken<'=', state>
        : ContinueToken<state>)
    : state['currentToken']['type'] extends '=' ? (
        Peek<state> extends '\'' | '"' ? StartToken<'AttributeValue', state>
        : UnexpectedChar<state>)
    : state['currentToken']['type'] extends 'AttributeValue' ? (
        Peek<state> extends '' ? UnexpectedChar<state>
        // Todo: entities logic is part of this? Maybe?
        : Peek<state> extends Delimiter<state['currentToken']> ? (
            PeekAfterAttributeDelimiter<state> extends '>' ? DelimitAttributeValueAndStart<'>', state>
            : PeekAfterAttributeDelimiter<state> extends '/>' ? DelimitAttributeValueAndStart<'/>', state>
            : PeekAfterAttributeDelimiter<state> extends Whitespace ? DelimitAttributeValueAndStart<'Whitespace', state>
            : TokenizationError<state, `Unexpected character ${PeekAfterAttributeDelimiter<state>} after AttributeValue (at '${state['currentToken']['literal']}')`>)
        : ContinueToken<state>)
    : state['currentToken']['type'] extends 'TextNode' ? (
        Peek<state> extends '' ? StartToken<'EOF', state>
        : Peek<state> extends '<' ? StartToken<'<', state> // Note: I tried dropping empty whitespace nodes here and it had no effect on max parse length
        : ContinueToken<state>)
    : state['currentToken']['type'] extends 'Comment' ? (
        Peek<state> extends '' ? UnexpectedChar<state>
        : PeekLength3<state> extends '-->' ? (
            PeekAfterCloseComment<state> extends '' ? DropCommentAndStart<'EOF', state>
            : PeekAfterCloseComment<state> extends '<' ? DropCommentAndStart<'<', state>
            : DropCommentAndStart<'TextNode', state>)
        : ContinueToken<state>)
    : state['currentToken']['type'] extends 'XMLDeclaration' | 'Doctype' ? (
        Peek<state> extends '' ? UnexpectedChar<state>
        : Peek<state> extends '>' ? (
            PeekAfterCloseDeclaration<state> extends '' ? DropDeclarationAndStart<'EOF', state>
            : PeekAfterCloseDeclaration<state> extends '<' ? DropDeclarationAndStart<'<', state>
            : DropDeclarationAndStart<'TextNode', state>)
        : ContinueToken<state>)
    : TokenizationError<state, `No implementation for token type ${state['currentToken']['type']}`>;
                                            
export type Tokenize<input extends string> = TokenizeStep<TokenizerState<[], Token<'SOF'>, input>>;