// filepath: src/components/CodeEditor/lib/pythonProvider.ts
import type * as Monaco from 'monaco-editor';

// exec, eval, compile, breakpoint, __import__ intentionally omitted —
// this editor is a viewer/editor only; it never runs or compiles code.
const PYTHON_BUILTINS: string[] = [
  'abs', 'aiter', 'all', 'anext', 'any', 'ascii', 'bin', 'bool',
  'bytearray', 'bytes', 'callable', 'chr', 'classmethod', 'complex',
  'delattr', 'dict', 'dir', 'divmod', 'enumerate',
  'filter', 'float', 'format', 'frozenset', 'getattr',
  'globals', 'hasattr', 'hash', 'help', 'hex', 'id', 'input', 'int',
  'isinstance', 'issubclass', 'iter', 'len', 'list', 'locals', 'map', 'max',
  'memoryview', 'min', 'next', 'object', 'oct', 'open', 'ord', 'pow', 'print',
  'property', 'range', 'repr', 'reversed', 'round', 'set', 'setattr',
  'slice', 'sorted', 'staticmethod', 'str', 'sum', 'super', 'tuple', 'type',
  'vars', 'zip',
];

const PYTHON_KEYWORDS: string[] = [
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break',
  'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally',
  'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal',
  'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
];

const PYTHON_SNIPPETS: Array<{
  label: string;
  insertText: string;
  documentation: string;
  detail: string;
}> = [
  {
    label: 'def',
    insertText: 'def ${1:function_name}(${2:args}) -> ${3:None}:\n    ${4:pass}',
    documentation: 'Define a function',
    detail: 'snippet: function definition',
  },
  {
    label: 'async def',
    insertText: 'async def ${1:function_name}(${2:args}) -> ${3:None}:\n    ${4:pass}',
    documentation: 'Define an async function',
    detail: 'snippet: async function definition',
  },
  {
    label: 'class',
    insertText:
      'class ${1:ClassName}${2:(object)}:\n    def __init__(self${3:, args}) -> None:\n        ${4:pass}',
    documentation: 'Define a class',
    detail: 'snippet: class definition',
  },
  {
    label: 'if __main__',
    insertText: 'if __name__ == "__main__":\n    ${1:main()}',
    documentation: 'Python entry point guard',
    detail: 'snippet: main guard',
  },
  {
    label: 'try',
    insertText:
      'try:\n    ${1:pass}\nexcept ${2:Exception} as ${3:e}:\n    ${4:raise}',
    documentation: 'Try/except block',
    detail: 'snippet: exception handling',
  },
  {
    label: 'try/finally',
    insertText:
      'try:\n    ${1:pass}\nexcept ${2:Exception} as ${3:e}:\n    ${4:raise}\nfinally:\n    ${5:pass}',
    documentation: 'Try/except/finally block',
    detail: 'snippet: exception handling with cleanup',
  },
  {
    label: 'with',
    insertText: 'with ${1:open}(${2:"file"}) as ${3:f}:\n    ${4:pass}',
    documentation: 'Context manager',
    detail: 'snippet: with statement',
  },
  {
    label: 'list comprehension',
    insertText: '[${1:expr} for ${2:item} in ${3:iterable}]',
    documentation: 'List comprehension',
    detail: 'snippet: list comprehension',
  },
  {
    label: 'dict comprehension',
    insertText: '{${1:key}: ${2:value} for ${3:item} in ${4:iterable}}',
    documentation: 'Dict comprehension',
    detail: 'snippet: dict comprehension',
  },
  {
    label: 'lambda',
    insertText: 'lambda ${1:args}: ${2:expression}',
    documentation: 'Lambda expression',
    detail: 'snippet: lambda',
  },
  {
    label: 'dataclass',
    insertText:
      '@dataclass\nclass ${1:ClassName}:\n    ${2:field}: ${3:type}',
    documentation: 'Dataclass definition (requires: from dataclasses import dataclass)',
    detail: 'snippet: dataclass',
  },
  {
    label: 'for loop',
    insertText: 'for ${1:item} in ${2:iterable}:\n    ${3:pass}',
    documentation: 'For loop',
    detail: 'snippet: for loop',
  },
  {
    label: 'while loop',
    insertText: 'while ${1:condition}:\n    ${2:pass}',
    documentation: 'While loop',
    detail: 'snippet: while loop',
  },
  {
    label: 'print',
    insertText: 'print(${1:value})',
    documentation: 'Print to stdout',
    detail: 'snippet: print statement',
  },
  {
    label: 'import',
    insertText: 'import ${1:module}',
    documentation: 'Import module',
    detail: 'snippet: import',
  },
  {
    label: 'from import',
    insertText: 'from ${1:module} import ${2:name}',
    documentation: 'Import from module',
    detail: 'snippet: from import',
  },
  {
    label: 'type hints',
    insertText: '${1:variable}: ${2:type} = ${3:value}',
    documentation: 'Type-annotated variable',
    detail: 'snippet: type annotation',
  },
];

const PYTHON_STDLIB_MODULES: Record<string, string[]> = {
  os: ['path', 'getcwd', 'listdir', 'makedirs', 'remove', 'rename', 'environ', 'getenv', 'sep'],
  sys: ['argv', 'exit', 'path', 'version', 'platform', 'stdin', 'stdout', 'stderr', 'modules'],
  json: ['dumps', 'loads', 'dump', 'load'],
  re: ['match', 'search', 'findall', 'sub', 'compile', 'split', 'fullmatch'],
  datetime: ['date', 'time', 'datetime', 'timedelta', 'timezone'],
  pathlib: ['Path'],
  typing: ['Optional', 'Union', 'List', 'Dict', 'Tuple', 'Set', 'Any', 'Callable', 'Generator', 'AsyncGenerator', 'TypeVar', 'Generic'],
  collections: ['defaultdict', 'Counter', 'OrderedDict', 'deque', 'namedtuple'],
  itertools: ['chain', 'product', 'combinations', 'permutations', 'groupby', 'islice'],
  functools: ['reduce', 'partial', 'lru_cache', 'wraps', 'cached_property'],
  asyncio: ['run', 'gather', 'sleep', 'create_task', 'Event', 'Lock', 'Queue'],
  dataclasses: ['dataclass', 'field', 'asdict', 'astuple'],
  contextlib: ['contextmanager', 'asynccontextmanager', 'suppress'],
};

export function registerPythonProvider(monaco: typeof Monaco): void {
  // Completion provider
  monaco.languages.registerCompletionItemProvider('python', {
    triggerCharacters: ['.', ' ', '(', 'import', 'from'],
    provideCompletionItems(
      model: Monaco.editor.ITextModel,
      position: Monaco.Position,
    ): Monaco.languages.CompletionList {
      const word = model.getWordUntilPosition(position);
      const range: Monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const lineContent = model.getLineContent(position.lineNumber);
      const textBeforeCursor = lineContent.substring(0, position.column - 1);

      // Module attribute completion (e.g., os.path.<cursor>)
      const dotMatch = textBeforeCursor.match(/(\w+)\.(\w*)$/);
      if (dotMatch) {
        const moduleName = dotMatch[1];
        const attrs = PYTHON_STDLIB_MODULES[moduleName];
        if (attrs) {
          return {
            suggestions: attrs.map((attr) => ({
              label: attr,
              kind: monaco.languages.CompletionItemKind.Property,
              insertText: attr,
              range,
              detail: `${moduleName}.${attr}`,
            })),
          };
        }
      }

      const suggestions: Monaco.languages.CompletionItem[] = [
        // Keywords
        ...PYTHON_KEYWORDS.map((kw) => ({
          label: kw,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: kw,
          range,
          detail: 'keyword',
          sortText: `0_${kw}`,
        })),
        // Built-ins
        ...PYTHON_BUILTINS.map((builtin) => ({
          label: builtin,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: `${builtin}($1)`,
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          detail: `built-in function`,
          documentation: { value: `**${builtin}** — Python built-in` },
          sortText: `1_${builtin}`,
        })),
        // Snippets
        ...PYTHON_SNIPPETS.map((s) => ({
          label: s.label,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: s.insertText,
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          detail: s.detail,
          documentation: { value: s.documentation },
          sortText: `2_${s.label}`,
        })),
        // stdlib imports
        ...Object.keys(PYTHON_STDLIB_MODULES).map((mod) => ({
          label: mod,
          kind: monaco.languages.CompletionItemKind.Module,
          insertText: mod,
          range,
          detail: `stdlib module: ${mod}`,
          sortText: `3_${mod}`,
        })),
      ];

      return { suggestions };
    },
  });

  // Hover provider
  monaco.languages.registerHoverProvider('python', {
    provideHover(
      model: Monaco.editor.ITextModel,
      position: Monaco.Position,
    ): Monaco.languages.Hover | null {
      const word = model.getWordAtPosition(position);
      if (!word) return null;

      const HOVER_DOCS: Record<string, string> = {
        print: '**print**(*objects, sep=\' \', end=\'\\n\', file=sys.stdout, flush=False*)\n\nPrint objects to the text stream file.',
        len: '**len**(*s*)\n\nReturn the length (the number of items) of an object.',
        range: '**range**(*stop*) / **range**(*start, stop[, step]*)\n\nReturn an immutable sequence of numbers.',
        list: '**list**([*iterable*])\n\nReturn a list. If no argument, return empty list.',
        dict: '**dict**(**kwargs) / **dict**(*mapping*, **kwargs)\n\nCreate a new dictionary.',
        str: '**str**(*object=b\'\'*, *encoding=\'utf-8\'*, *errors=\'strict\'*)\n\nReturn a string version of object.',
        int: '**int**(*x=0*) / **int**(*x*, *base=10*)\n\nReturn an integer object.',
        float: '**float**(*x=0.0*)\n\nReturn a floating-point number.',
        type: '**type**(*object*) / **type**(*name, bases, dict*)\n\nWith one argument, return the type of an object.',
        isinstance: '**isinstance**(*object, classinfo*)\n\nReturn True if object is an instance of classinfo.',
        enumerate: '**enumerate**(*iterable, start=0*)\n\nReturn an enumerate object.',
        zip: '**zip**(*iterables, strict=False*)\n\nMake an iterator that aggregates elements from each iterable.',
        map: '**map**(*function, iterable, ...*)\n\nReturn an iterator that applies function to every item of iterable.',
        filter: '**filter**(*function, iterable*)\n\nConstruct an iterator from iterable elements for which function returns true.',
        sorted: '**sorted**(*iterable, /, *, key=None, reverse=False*)\n\nReturn a new sorted list from the items in iterable.',
        open: '**open**(*file, mode=\'r\', buffering=-1, encoding=None, errors=None, newline=None, closefd=True, opener=None*)\n\nOpen a file and return a file object.',
      };

      if (HOVER_DOCS[word.word]) {
        return {
          range: new monaco.Range(
            position.lineNumber,
            word.startColumn,
            position.lineNumber,
            word.endColumn,
          ),
          contents: [{ value: HOVER_DOCS[word.word] }],
        };
      }

      return null;
    },
  });

  // Signature help provider
  monaco.languages.registerSignatureHelpProvider('python', {
    signatureHelpTriggerCharacters: ['(', ','],
    provideSignatureHelp(
      model: Monaco.editor.ITextModel,
      position: Monaco.Position,
    ): Monaco.languages.SignatureHelpResult | null {
      const lineContent = model.getLineContent(position.lineNumber);
      const textBefore = lineContent.substring(0, position.column - 1);
      const funcMatch = textBefore.match(/(\w+)\s*\(([^)]*)$/);
      if (!funcMatch) return null;

      const funcName = funcMatch[1];

      const SIGNATURES: Record<string, Monaco.languages.SignatureInformation[]> = {
        print: [{
          label: 'print(*objects, sep=\' \', end=\'\\n\', file=sys.stdout, flush=False)',
          documentation: 'Print objects to the text stream file',
          parameters: [
            { label: '*objects', documentation: 'Objects to print' },
            { label: "sep=' '", documentation: 'Separator between objects' },
            { label: "end='\\n'", documentation: 'Appended after last object' },
            { label: 'file=sys.stdout', documentation: 'Output stream' },
            { label: 'flush=False', documentation: 'Whether to flush the stream' },
          ],
        }],
        range: [{
          label: 'range(stop) | range(start, stop[, step])',
          documentation: 'Return an immutable sequence of numbers',
          parameters: [
            { label: 'start', documentation: 'Start of range (inclusive)' },
            { label: 'stop', documentation: 'End of range (exclusive)' },
            { label: 'step', documentation: 'Step size (default: 1)' },
          ],
        }],
        open: [{
          label: "open(file, mode='r', buffering=-1, encoding=None, errors=None)",
          documentation: 'Open a file and return a file object',
          parameters: [
            { label: 'file', documentation: 'File path or file descriptor' },
            { label: "mode='r'", documentation: 'File open mode (r, w, a, b, +, x)' },
            { label: 'buffering=-1', documentation: 'Buffering policy' },
            { label: 'encoding=None', documentation: 'Text encoding (e.g. utf-8)' },
            { label: 'errors=None', documentation: 'Error handler (strict, ignore, replace)' },
          ],
        }],
      };

      const sigs = SIGNATURES[funcName];
      if (!sigs) return null;

      const commaCount = (funcMatch[2].match(/,/g) || []).length;

      return {
        value: {
          signatures: sigs,
          activeSignature: 0,
          activeParameter: Math.min(commaCount, sigs[0].parameters!.length - 1),
        },
        dispose: () => {},
      };
    },
  });

}
