# type-xml

This is an experiment in pushing the limits of the TypeScript compiler: an XML parser that operates entirely on string literal types. You can parse a string literal type and get meaningful data out of it, and 100% of the code will go away when compiled.

```
# to install:
npm install type-xml
```

```typescript
import { Parse } from 'type-xml';

type input = `<div id="1" style="background: blue">
  <selfClosing />
  Foo
  <span id="2">Bar</span>
  <span id="3">Baz</span>
  Qux
</div>`;

type output = Parse<input>[0]; // "Returns" an array (tuple) of string types and Node object types

type a = output['tag']; // "div"
type b = output['attributes']['style']; // "background: blue"
type c = output['children']; // [Node<'selfClosing'>, "Foo", ...] (note: several whitespace text nodes removed for clarity)
```

## Caveats
This is largely a proof of concept/experiment. It's certainly not spec compliant and is not suitable for use in a production environment. Some things worth noting:

- It can only handle fairly small input strings. The longest I've gotten it to parse was 1250 characters long, and about 270 tokens. I'm not sure whether it's the character length or number of tokens, but either way longer files cause TypeScript to hit its maximum recursion depth.
- Behavior for poorly-formed XML isn't guaranteed to be correct.
- The spec explicitly lists character ranges that are acceptable in tag/attribute names. Reproducing those character lists in TS would quickly get unwieldy and is probably impossible, so this parser errs on the side of being forgiving. That means that invalid names like `<1^ />` will be treated as valid.

### Supported XML language features
Only a subset of XML language features are supported. If your documents are well-formed and limited to tags, text-nodes, attributes, self-closing tags, doctypes/XML-declarations, and comments, you should be safe.

- Entities (escaped characters) are not handled. so `<foo bar="&quot;" />` will give you a value for bar of `&quot;`.
- Comments,`<!DOCTYPE`, and `<?xml` are consumed and ignored.
- Other, jankier features like `<![CDATA[` will either be ignored or give a TokenizationError (I haven't actually tested them whoops)
- HTML-specific features like non-delimited attributes, boolean attribute shorthand, and error recovery are not supported.
