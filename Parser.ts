import { Tokenize, Token, TokenType } from './Tokenizer';

type Output = (Node | string)[];
type Node<tag extends string = string, attributes extends {} = {}, children extends Output = Output> = {
    tag: tag,
    attributes: attributes,
    children: children,
};

type Peek<restOfTokens extends Token[]> = restOfTokens extends [infer first, ...Token[]] ? first : Token;
type Peek2<restOfTokens extends Token[]> = restOfTokens extends [Token, infer second, ...Token[]] ? second : Token;
type Rest<restOfTokens extends Token[]> = restOfTokens extends [Token, ...infer rest] ? rest : [];
type Rest2<restOfTokens extends Token[]> = restOfTokens extends [Token, Token, ...infer rest] ? rest : [];
type Rest3<restOfTokens extends Token[]> = restOfTokens extends [Token, Token, Token, ...infer rest] ? rest : [];
type RemoveDelimiters<input> = input extends `${'\'' | '"'}${infer middle}${'\'' | '"'}` ? middle : input;
type ParseError<err extends string> = `ParseError: ${err}`;

// These are basically just tuples for getting both partial data and restOfInput out of a... function?
type SingleNodeState<output extends Node = Node, restOfTokens extends Token[] = Token[]> = { output: output, restOfTokens: restOfTokens };
type MultiNodeState<output extends (Node | string)[], restOfTokens extends Token[]> = { output: output, restOfTokens: restOfTokens };

type ParseAttribute<node extends Node, restOfTokens extends Token[]> =
    restOfTokens extends [Token<TokenType, infer attrName>, Token, Token<TokenType, infer attrValue>, ...infer rest]
    ? rest extends Token[] // Rest<Array> can lose some type information in a way that isn't an issue with strings, I haven't nailed down how to fix it yet. This is also the reason we're not using Single/MultiNodeState everywhere
    ? SingleNodeState<Node<node['tag'], {
        // functionally the same as node['attributes'] & { [key in attrName]: attrValue } but makes a prettier type
        [key in keyof node['attributes'] | attrName]: key extends keyof node['attributes'] ? node['attributes'][key] : RemoveDelimiters<attrValue>;
    }>, rest>
    : never : never;

type ParseAttributes<node extends Node, restOfTokens extends Token[]> =
    Peek<restOfTokens>['type'] extends '>' ?
        ParseNodes<[], Rest<restOfTokens>, node['tag']> extends MultiNodeState<infer children, infer newRest>
        ? SingleNodeState<Node<node['tag'], node['attributes'], children>, newRest>
        : ParseNodes<[], Rest<restOfTokens>, node['tag']> // Propagate errors
    : Peek<restOfTokens>['type'] extends '/>' ? SingleNodeState<Node<node['tag'], node['attributes'], []>, Rest<restOfTokens>>
    : ParseAttribute<node, restOfTokens> extends SingleNodeState<infer newNode, infer newRest>
        ? ParseAttributes<newNode, newRest>
        : never;

type ParseStartTag<restOfTokens extends Token[]> = ParseAttributes<Node<Peek2<restOfTokens>['literal'], {}>, Rest2<restOfTokens>>;

type ParseNodes<output extends (Node | string)[], restOfTokens extends Token[], parentTagName extends string> =
    Peek<restOfTokens>['type'] extends 'EOF' ?
        parentTagName extends ''
        ? output // Dump output in user-accessible form, not wrapped in an internal tuple
        : ParseError<`Unexpected end of input (expected closing tag </${parentTagName}>)`>
    : Peek<restOfTokens>['type'] extends 'TextNode' ? ParseNodes<[...output, Peek<restOfTokens>['literal']], Rest<restOfTokens>, parentTagName>
    : Peek<restOfTokens>['type'] extends '<' ?
        ParseStartTag<restOfTokens> extends SingleNodeState<infer node, infer newRestOfTokens>
        ? ParseNodes<[...output, node], newRestOfTokens, parentTagName>
        : ParseStartTag<restOfTokens> // Propagate errors
    : Peek<restOfTokens>['type'] extends '</' ?
        Peek2<restOfTokens>['literal'] extends parentTagName
        ? MultiNodeState<output, Rest3<restOfTokens>>
        : ParseError<`Unexpected </${Peek2<restOfTokens>['literal']}> (expected closing tag </${parentTagName}>)`>
    : ParseError<`Unexpected token type ${Peek<restOfTokens>['type']}`>;

type ParseInternal<tokensOrError extends Token[] | string> = tokensOrError extends Token[] ? ParseNodes<[], tokensOrError, ''> : tokensOrError;
export type Parse<input extends string> = ParseInternal<Tokenize<input>>;
