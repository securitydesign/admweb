(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const AstNode_1 = __importDefault(require("./AstNode"));
const Parser_1 = require("./Parser");
const Errors_1 = require("./Errors");
class AstBuilder {
    constructor(newId) {
        this.newId = newId;
        if (!newId) {
            throw new Error('No newId');
        }
        this.reset();
    }
    reset() {
        this.stack = [new AstNode_1.default(Parser_1.RuleType.None)];
        this.comments = [];
    }
    startRule(ruleType) {
        this.stack.push(new AstNode_1.default(ruleType));
    }
    endRule() {
        const node = this.stack.pop();
        const transformedNode = this.transformNode(node);
        this.currentNode().add(node.ruleType, transformedNode);
    }
    build(token) {
        if (token.matchedType === Parser_1.TokenType.Comment) {
            this.comments.push({
                location: this.getLocation(token),
                text: token.matchedText,
            });
        }
        else {
            this.currentNode().add(token.matchedType, token);
        }
    }
    getResult() {
        return this.currentNode().getSingle(Parser_1.RuleType.GherkinDocument);
    }
    currentNode() {
        return this.stack[this.stack.length - 1];
    }
    getLocation(token, column) {
        return !column ? token.location : { line: token.location.line, column };
    }
    getTags(node) {
        const tags = [];
        const tagsNode = node.getSingle(Parser_1.RuleType.Tags);
        if (!tagsNode) {
            return tags;
        }
        const tokens = tagsNode.getTokens(Parser_1.TokenType.TagLine);
        for (const token of tokens) {
            for (const tagItem of token.matchedItems) {
                tags.push({
                    location: this.getLocation(token, tagItem.column),
                    name: tagItem.text,
                    id: this.newId(),
                });
            }
        }
        return tags;
    }
    getCells(tableRowToken) {
        return tableRowToken.matchedItems.map((cellItem) => ({
            location: this.getLocation(tableRowToken, cellItem.column),
            value: cellItem.text,
        }));
    }
    getDescription(node) {
        return node.getSingle(Parser_1.RuleType.Description) || '';
    }
    getSteps(node) {
        return node.getItems(Parser_1.RuleType.Step);
    }
    getTableRows(node) {
        const rows = node.getTokens(Parser_1.TokenType.TableRow).map((token) => ({
            id: this.newId(),
            location: this.getLocation(token),
            cells: this.getCells(token),
        }));
        this.ensureCellCount(rows);
        return rows.length === 0 ? [] : rows;
    }
    ensureCellCount(rows) {
        if (rows.length === 0) {
            return;
        }
        const cellCount = rows[0].cells.length;
        rows.forEach((row) => {
            if (row.cells.length !== cellCount) {
                throw Errors_1.AstBuilderException.create('inconsistent cell count within the table', row.location);
            }
        });
    }
    transformNode(node) {
        switch (node.ruleType) {
            case Parser_1.RuleType.Step: {
                const stepLine = node.getToken(Parser_1.TokenType.StepLine);
                const dataTable = node.getSingle(Parser_1.RuleType.DataTable);
                const docString = node.getSingle(Parser_1.RuleType.DocString);
                const location = this.getLocation(stepLine);
                const step = {
                    id: this.newId(),
                    location,
                    keyword: stepLine.matchedKeyword,
                    keywordType: stepLine.matchedKeywordType,
                    text: stepLine.matchedText,
                    dataTable: dataTable,
                    docString: docString,
                };
                return step;
            }
            case Parser_1.RuleType.DocString: {
                const separatorToken = node.getTokens(Parser_1.TokenType.DocStringSeparator)[0];
                const mediaType = separatorToken.matchedText.length > 0 ? separatorToken.matchedText : undefined;
                const lineTokens = node.getTokens(Parser_1.TokenType.Other);
                const content = lineTokens.map((t) => t.matchedText).join('\n');
                const result = {
                    location: this.getLocation(separatorToken),
                    content,
                    delimiter: separatorToken.matchedKeyword,
                };
                // conditionally add this like this (needed to make tests pass on node 0.10 as well as 4.0)
                if (mediaType) {
                    result.mediaType = mediaType;
                }
                return result;
            }
            case Parser_1.RuleType.DataTable: {
                const rows = this.getTableRows(node);
                const dataTable = {
                    location: rows[0].location,
                    rows,
                };
                return dataTable;
            }
            case Parser_1.RuleType.Background: {
                const backgroundLine = node.getToken(Parser_1.TokenType.BackgroundLine);
                const description = this.getDescription(node);
                const steps = this.getSteps(node);
                const background = {
                    id: this.newId(),
                    location: this.getLocation(backgroundLine),
                    keyword: backgroundLine.matchedKeyword,
                    name: backgroundLine.matchedText,
                    description,
                    steps,
                };
                return background;
            }
            case Parser_1.RuleType.ScenarioDefinition: {
                const tags = this.getTags(node);
                const scenarioNode = node.getSingle(Parser_1.RuleType.Scenario);
                const scenarioLine = scenarioNode.getToken(Parser_1.TokenType.ScenarioLine);
                const description = this.getDescription(scenarioNode);
                const steps = this.getSteps(scenarioNode);
                const examples = scenarioNode.getItems(Parser_1.RuleType.ExamplesDefinition);
                const scenario = {
                    id: this.newId(),
                    tags,
                    location: this.getLocation(scenarioLine),
                    keyword: scenarioLine.matchedKeyword,
                    name: scenarioLine.matchedText,
                    description,
                    steps,
                    examples,
                };
                return scenario;
            }
            case Parser_1.RuleType.ExamplesDefinition: {
                const tags = this.getTags(node);
                const examplesNode = node.getSingle(Parser_1.RuleType.Examples);
                const examplesLine = examplesNode.getToken(Parser_1.TokenType.ExamplesLine);
                const description = this.getDescription(examplesNode);
                const examplesTable = examplesNode.getSingle(Parser_1.RuleType.ExamplesTable);
                const examples = {
                    id: this.newId(),
                    tags,
                    location: this.getLocation(examplesLine),
                    keyword: examplesLine.matchedKeyword,
                    name: examplesLine.matchedText,
                    description,
                    tableHeader: examplesTable ? examplesTable[0] : undefined,
                    tableBody: examplesTable ? examplesTable.slice(1) : [],
                };
                return examples;
            }
            case Parser_1.RuleType.ExamplesTable: {
                return this.getTableRows(node);
            }
            case Parser_1.RuleType.Description: {
                let lineTokens = node.getTokens(Parser_1.TokenType.Other);
                // Trim trailing empty lines
                let end = lineTokens.length;
                while (end > 0 && lineTokens[end - 1].line.trimmedLineText === '') {
                    end--;
                }
                lineTokens = lineTokens.slice(0, end);
                return lineTokens.map((token) => token.matchedText).join('\n');
            }
            case Parser_1.RuleType.Feature: {
                const header = node.getSingle(Parser_1.RuleType.FeatureHeader);
                if (!header) {
                    return null;
                }
                const tags = this.getTags(header);
                const featureLine = header.getToken(Parser_1.TokenType.FeatureLine);
                if (!featureLine) {
                    return null;
                }
                const children = [];
                const background = node.getSingle(Parser_1.RuleType.Background);
                if (background) {
                    children.push({
                        background,
                    });
                }
                for (const scenario of node.getItems(Parser_1.RuleType.ScenarioDefinition)) {
                    children.push({
                        scenario,
                    });
                }
                for (const rule of node.getItems(Parser_1.RuleType.Rule)) {
                    children.push({
                        rule,
                    });
                }
                const description = this.getDescription(header);
                const language = featureLine.matchedGherkinDialect;
                const feature = {
                    tags,
                    location: this.getLocation(featureLine),
                    language,
                    keyword: featureLine.matchedKeyword,
                    name: featureLine.matchedText,
                    description,
                    children,
                };
                return feature;
            }
            case Parser_1.RuleType.Rule: {
                const header = node.getSingle(Parser_1.RuleType.RuleHeader);
                if (!header) {
                    return null;
                }
                const ruleLine = header.getToken(Parser_1.TokenType.RuleLine);
                if (!ruleLine) {
                    return null;
                }
                const tags = this.getTags(header);
                const children = [];
                const background = node.getSingle(Parser_1.RuleType.Background);
                if (background) {
                    children.push({
                        background,
                    });
                }
                for (const scenario of node.getItems(Parser_1.RuleType.ScenarioDefinition)) {
                    children.push({
                        scenario,
                    });
                }
                const description = this.getDescription(header);
                const rule = {
                    id: this.newId(),
                    location: this.getLocation(ruleLine),
                    keyword: ruleLine.matchedKeyword,
                    name: ruleLine.matchedText,
                    description,
                    children,
                    tags,
                };
                return rule;
            }
            case Parser_1.RuleType.GherkinDocument: {
                const feature = node.getSingle(Parser_1.RuleType.Feature);
                const gherkinDocument = {
                    feature,
                    comments: this.comments,
                };
                return gherkinDocument;
            }
            default:
                return node;
        }
    }
}
exports.default = AstBuilder;
window.AstBuilder = AstBuilder;

},{"./AstNode":2,"./Errors":3,"./Parser":7}],2:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class AstNode {
    constructor(ruleType) {
        this.ruleType = ruleType;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.subItems = new Map();
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    add(type, obj) {
        let items = this.subItems.get(type);
        if (items === undefined) {
            items = [];
            this.subItems.set(type, items);
        }
        items.push(obj);
    }
    getSingle(ruleType) {
        return (this.subItems.get(ruleType) || [])[0];
    }
    getItems(ruleType) {
        return this.subItems.get(ruleType) || [];
    }
    getToken(tokenType) {
        return (this.subItems.get(tokenType) || [])[0];
    }
    getTokens(tokenType) {
        return this.subItems.get(tokenType) || [];
    }
}
exports.default = AstNode;
window.AstNode = AstNode;

},{}],3:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoSuchLanguageException = exports.AstBuilderException = exports.CompositeParserException = exports.ParserException = exports.GherkinException = void 0;
class GherkinException extends Error {
    constructor(message) {
        super(message);
        const actualProto = new.target.prototype;
        // https://stackoverflow.com/questions/41102060/typescript-extending-error-class
        if (Object.setPrototypeOf) {
            Object.setPrototypeOf(this, actualProto);
        }
        else {
            // @ts-ignore
            this.__proto__ = actualProto;
        }
    }
    static _create(message, location) {
        const column = location != null ? location.column || 0 : -1;
        const line = location != null ? location.line || 0 : -1;
        const m = `(${line}:${column}): ${message}`;
        const err = new this(m);
        err.location = location;
        return err;
    }
}
exports.GherkinException = GherkinException;
class ParserException extends GherkinException {
    static create(message, line, column) {
        const err = new this(`(${line}:${column}): ${message}`);
        err.location = { line, column };
        return err;
    }
}
exports.ParserException = ParserException;
class CompositeParserException extends GherkinException {
    static create(errors) {
        const message = 'Parser errors:\n' + errors.map((e) => e.message).join('\n');
        const err = new this(message);
        err.errors = errors;
        return err;
    }
}
exports.CompositeParserException = CompositeParserException;
class AstBuilderException extends GherkinException {
    static create(message, location) {
        return this._create(message, location);
    }
}
exports.AstBuilderException = AstBuilderException;
class NoSuchLanguageException extends GherkinException {
    static create(language, location) {
        const message = 'Language not supported: ' + language;
        return this._create(message, location);
    }
}
exports.NoSuchLanguageException = NoSuchLanguageException;

},{}],4:[function(require,module,exports){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const gherkin_languages_json_1 = __importDefault(require("./gherkin-languages.json"));
const Errors_1 = require("./Errors");
const messages = __importStar(require("@cucumber/messages"));
const Parser_1 = require("./Parser");
const countSymbols_1 = __importDefault(require("./countSymbols"));
const DIALECT_DICT = gherkin_languages_json_1.default;
window.DIALECT_DICT = DIALECT_DICT;
const LANGUAGE_PATTERN = /^\s*#\s*language\s*:\s*([a-zA-Z\-_]+)\s*$/;
function addKeywordTypeMappings(h, keywords, keywordType) {
    for (const k of keywords) {
        if (!(k in h)) {
            h[k] = [];
        }
        h[k].push(keywordType);
    }
}
class GherkinClassicTokenMatcher {
    constructor(defaultDialectName = 'en') {
        this.defaultDialectName = defaultDialectName;
        this.reset();
    }
    changeDialect(newDialectName, location) {
        const newDialect = DIALECT_DICT[newDialectName];
        if (!newDialect) {
            throw Errors_1.NoSuchLanguageException.create(newDialectName, location);
        }
        this.dialectName = newDialectName;
        this.dialect = newDialect;
        this.initializeKeywordTypes();
    }
    reset() {
        if (this.dialectName !== this.defaultDialectName) {
            this.changeDialect(this.defaultDialectName);
        }
        this.activeDocStringSeparator = null;
        this.indentToRemove = 0;
    }
    initializeKeywordTypes() {
        this.keywordTypesMap = {};
        addKeywordTypeMappings(this.keywordTypesMap, this.dialect.given, messages.StepKeywordType.CONTEXT);
        addKeywordTypeMappings(this.keywordTypesMap, this.dialect.when, messages.StepKeywordType.ACTION);
        addKeywordTypeMappings(this.keywordTypesMap, this.dialect.then, messages.StepKeywordType.OUTCOME);
        addKeywordTypeMappings(this.keywordTypesMap, [].concat(this.dialect.and).concat(this.dialect.but), messages.StepKeywordType.CONJUNCTION);
    }
    match_TagLine(token) {
        if (token.line.startsWith('@')) {
            this.setTokenMatched(token, Parser_1.TokenType.TagLine, null, null, null, null, this.getTags(token.line));
            return true;
        }
        return false;
    }
    match_FeatureLine(token) {
        return this.matchTitleLine(token, Parser_1.TokenType.FeatureLine, this.dialect.feature);
    }
    match_ScenarioLine(token) {
        return (this.matchTitleLine(token, Parser_1.TokenType.ScenarioLine, this.dialect.scenario) ||
            this.matchTitleLine(token, Parser_1.TokenType.ScenarioLine, this.dialect.scenarioOutline));
    }
    match_BackgroundLine(token) {
        return this.matchTitleLine(token, Parser_1.TokenType.BackgroundLine, this.dialect.background);
    }
    match_ExamplesLine(token) {
        return this.matchTitleLine(token, Parser_1.TokenType.ExamplesLine, this.dialect.examples);
    }
    match_RuleLine(token) {
        return this.matchTitleLine(token, Parser_1.TokenType.RuleLine, this.dialect.rule);
    }
    match_TableRow(token) {
        if (token.line.startsWith('|')) {
            // TODO: indent
            this.setTokenMatched(token, Parser_1.TokenType.TableRow, null, null, null, null, token.line.getTableCells());
            return true;
        }
        return false;
    }
    match_Empty(token) {
        if (token.line.isEmpty) {
            this.setTokenMatched(token, Parser_1.TokenType.Empty, null, null, 0);
            return true;
        }
        return false;
    }
    match_Comment(token) {
        if (token.line.startsWith('#')) {
            const text = token.line.getLineText(0); // take the entire line, including leading space
            this.setTokenMatched(token, Parser_1.TokenType.Comment, text, null, 0);
            return true;
        }
        return false;
    }
    match_Language(token) {
        const match = token.line.trimmedLineText.match(LANGUAGE_PATTERN);
        if (match) {
            const newDialectName = match[1];
            this.setTokenMatched(token, Parser_1.TokenType.Language, newDialectName);
            this.changeDialect(newDialectName, token.location);
            return true;
        }
        return false;
    }
    match_DocStringSeparator(token) {
        return this.activeDocStringSeparator == null
            ? // open
                this._match_DocStringSeparator(token, '"""', true) ||
                    this._match_DocStringSeparator(token, '```', true)
            : // close
                this._match_DocStringSeparator(token, this.activeDocStringSeparator, false);
    }
    _match_DocStringSeparator(token, separator, isOpen) {
        if (token.line.startsWith(separator)) {
            let mediaType = null;
            if (isOpen) {
                mediaType = token.line.getRestTrimmed(separator.length);
                this.activeDocStringSeparator = separator;
                this.indentToRemove = token.line.indent;
            }
            else {
                this.activeDocStringSeparator = null;
                this.indentToRemove = 0;
            }
            this.setTokenMatched(token, Parser_1.TokenType.DocStringSeparator, mediaType, separator);
            return true;
        }
        return false;
    }
    match_EOF(token) {
        if (token.isEof) {
            this.setTokenMatched(token, Parser_1.TokenType.EOF);
            return true;
        }
        return false;
    }
    match_StepLine(token) {
        const keywords = []
            .concat(this.dialect.given)
            .concat(this.dialect.when)
            .concat(this.dialect.then)
            .concat(this.dialect.and)
            .concat(this.dialect.but);
        for (const keyword of keywords) {
            if (token.line.startsWith(keyword)) {
                const title = token.line.getRestTrimmed(keyword.length);
                const keywordTypes = this.keywordTypesMap[keyword];
                let keywordType = keywordTypes[0];
                if (keywordTypes.length > 1) {
                    keywordType = messages.StepKeywordType.UNKNOWN;
                }
                this.setTokenMatched(token, Parser_1.TokenType.StepLine, title, keyword, null, keywordType);
                return true;
            }
        }
        return false;
    }
    match_Other(token) {
        const text = token.line.getLineText(this.indentToRemove); // take the entire line, except removing DocString indents
        this.setTokenMatched(token, Parser_1.TokenType.Other, this.unescapeDocString(text), null, 0);
        return true;
    }
    getTags(line) {
        const uncommentedLine = line.trimmedLineText.split(/\s#/g, 2)[0];
        let column = line.indent + 1;
        const items = uncommentedLine.split('@');
        const tags = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i].trimRight();
            if (item.length == 0) {
                continue;
            }
            if (!item.match(/^\S+$/)) {
                throw Errors_1.ParserException.create('A tag may not contain whitespace', line.lineNumber, column);
            }
            const span = { column, text: '@' + item };
            tags.push(span);
            column += (0, countSymbols_1.default)(items[i]) + 1;
        }
        return tags;
    }
    matchTitleLine(token, tokenType, keywords) {
        for (const keyword of keywords) {
            if (token.line.startsWithTitleKeyword(keyword)) {
                const title = token.line.getRestTrimmed(keyword.length + ':'.length);
                this.setTokenMatched(token, tokenType, title, keyword);
                return true;
            }
        }
        return false;
    }
    setTokenMatched(token, matchedType, text, keyword, indent, keywordType, items) {
        token.matchedType = matchedType;
        token.matchedText = text;
        token.matchedKeyword = keyword;
        token.matchedKeywordType = keywordType;
        token.matchedIndent =
            typeof indent === 'number' ? indent : token.line == null ? 0 : token.line.indent;
        token.matchedItems = items || [];
        token.location.column = token.matchedIndent + 1;
        token.matchedGherkinDialect = this.dialectName;
    }
    unescapeDocString(text) {
        if (this.activeDocStringSeparator === '"""') {
            return text.replace('\\"\\"\\"', '"""');
        }
        if (this.activeDocStringSeparator === '```') {
            return text.replace('\\`\\`\\`', '```');
        }
        return text;
    }
}
exports.default = GherkinClassicTokenMatcher;
window.GherkinClassicTokenMatcher = GherkinClassicTokenMatcher;

},{"./Errors":3,"./Parser":7,"./countSymbols":10,"./gherkin-languages.json":12,"@cucumber/messages":19}],5:[function(require,module,exports){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Parser_1 = require("./Parser");
const gherkin_languages_json_1 = __importDefault(require("./gherkin-languages.json"));
const messages = __importStar(require("@cucumber/messages"));
const Errors_1 = require("./Errors");
const DIALECT_DICT = gherkin_languages_json_1.default;
const DEFAULT_DOC_STRING_SEPARATOR = /^(```[`]*)(.*)/;
function addKeywordTypeMappings(h, keywords, keywordType) {
    for (const k of keywords) {
        if (!(k in h)) {
            h[k] = [];
        }
        h[k].push(keywordType);
    }
}
class GherkinInMarkdownTokenMatcher {
    constructor(defaultDialectName = 'en') {
        this.defaultDialectName = defaultDialectName;
        this.dialect = DIALECT_DICT[defaultDialectName];
        this.nonStarStepKeywords = []
            .concat(this.dialect.given)
            .concat(this.dialect.when)
            .concat(this.dialect.then)
            .concat(this.dialect.and)
            .concat(this.dialect.but)
            .filter((value, index, self) => value !== '* ' && self.indexOf(value) === index);
        this.initializeKeywordTypes();
        this.stepRegexp = new RegExp(`${KeywordPrefix.BULLET}(${this.nonStarStepKeywords.map(escapeRegExp).join('|')})`);
        const headerKeywords = []
            .concat(this.dialect.feature)
            .concat(this.dialect.background)
            .concat(this.dialect.rule)
            .concat(this.dialect.scenarioOutline)
            .concat(this.dialect.scenario)
            .concat(this.dialect.examples)
            .filter((value, index, self) => self.indexOf(value) === index);
        this.headerRegexp = new RegExp(`${KeywordPrefix.HEADER}(${headerKeywords.map(escapeRegExp).join('|')})`);
        this.reset();
    }
    changeDialect(newDialectName, location) {
        const newDialect = DIALECT_DICT[newDialectName];
        if (!newDialect) {
            throw Errors_1.NoSuchLanguageException.create(newDialectName, location);
        }
        this.dialectName = newDialectName;
        this.dialect = newDialect;
        this.initializeKeywordTypes();
    }
    initializeKeywordTypes() {
        this.keywordTypesMap = {};
        addKeywordTypeMappings(this.keywordTypesMap, this.dialect.given, messages.StepKeywordType.CONTEXT);
        addKeywordTypeMappings(this.keywordTypesMap, this.dialect.when, messages.StepKeywordType.ACTION);
        addKeywordTypeMappings(this.keywordTypesMap, this.dialect.then, messages.StepKeywordType.OUTCOME);
        addKeywordTypeMappings(this.keywordTypesMap, [].concat(this.dialect.and).concat(this.dialect.but), messages.StepKeywordType.CONJUNCTION);
    }
    // We've made a deliberate choice not to support `# language: [ISO 639-1]` headers or similar
    // in Markdown. Users should specify a language globally. This can be done in
    // cucumber-js using the --language [ISO 639-1] option.
    match_Language(token) {
        if (!token)
            throw new Error('no token');
        return false;
    }
    match_Empty(token) {
        let result = false;
        if (token.line.isEmpty) {
            result = true;
        }
        if (!this.match_TagLine(token) &&
            !this.match_FeatureLine(token) &&
            !this.match_ScenarioLine(token) &&
            !this.match_BackgroundLine(token) &&
            !this.match_ExamplesLine(token) &&
            !this.match_RuleLine(token) &&
            !this.match_TableRow(token) &&
            !this.match_Comment(token) &&
            !this.match_Language(token) &&
            !this.match_DocStringSeparator(token) &&
            !this.match_EOF(token) &&
            !this.match_StepLine(token)) {
            // neutered
            result = true;
        }
        if (result) {
            token.matchedType = Parser_1.TokenType.Empty;
        }
        return this.setTokenMatched(token, null, result);
    }
    match_Other(token) {
        const text = token.line.getLineText(this.indentToRemove); // take the entire line, except removing DocString indents
        token.matchedType = Parser_1.TokenType.Other;
        token.matchedText = text;
        token.matchedIndent = 0;
        return this.setTokenMatched(token, null, true);
    }
    match_Comment(token) {
        let result = false;
        if (token.line.startsWith('|')) {
            const tableCells = token.line.getTableCells();
            if (this.isGfmTableSeparator(tableCells))
                result = true;
        }
        return this.setTokenMatched(token, null, result);
    }
    match_DocStringSeparator(token) {
        const match = token.line.trimmedLineText.match(this.activeDocStringSeparator);
        const [, newSeparator, mediaType] = match || [];
        let result = false;
        if (newSeparator) {
            if (this.activeDocStringSeparator === DEFAULT_DOC_STRING_SEPARATOR) {
                this.activeDocStringSeparator = new RegExp(`^(${newSeparator})$`);
                this.indentToRemove = token.line.indent;
            }
            else {
                this.activeDocStringSeparator = DEFAULT_DOC_STRING_SEPARATOR;
            }
            token.matchedKeyword = newSeparator;
            token.matchedType = Parser_1.TokenType.DocStringSeparator;
            token.matchedText = mediaType || '';
            result = true;
        }
        return this.setTokenMatched(token, null, result);
    }
    match_EOF(token) {
        let result = false;
        if (token.isEof) {
            token.matchedType = Parser_1.TokenType.EOF;
            result = true;
        }
        return this.setTokenMatched(token, null, result);
    }
    match_FeatureLine(token) {
        if (this.matchedFeatureLine) {
            return this.setTokenMatched(token, null, false);
        }
        // We first try to match "# Feature: blah"
        let result = this.matchTitleLine(KeywordPrefix.HEADER, this.dialect.feature, ':', token, Parser_1.TokenType.FeatureLine);
        // If we didn't match "# Feature: blah", we still match this line
        // as a FeatureLine.
        // The reason for this is that users may not want to be constrained by having this as their fist line.
        if (!result) {
            token.matchedType = Parser_1.TokenType.FeatureLine;
            token.matchedText = token.line.trimmedLineText;
            result = this.setTokenMatched(token, null, true);
        }
        this.matchedFeatureLine = result;
        return result;
    }
    match_BackgroundLine(token) {
        return this.matchTitleLine(KeywordPrefix.HEADER, this.dialect.background, ':', token, Parser_1.TokenType.BackgroundLine);
    }
    match_RuleLine(token) {
        return this.matchTitleLine(KeywordPrefix.HEADER, this.dialect.rule, ':', token, Parser_1.TokenType.RuleLine);
    }
    match_ScenarioLine(token) {
        return (this.matchTitleLine(KeywordPrefix.HEADER, this.dialect.scenario, ':', token, Parser_1.TokenType.ScenarioLine) ||
            this.matchTitleLine(KeywordPrefix.HEADER, this.dialect.scenarioOutline, ':', token, Parser_1.TokenType.ScenarioLine));
    }
    match_ExamplesLine(token) {
        return this.matchTitleLine(KeywordPrefix.HEADER, this.dialect.examples, ':', token, Parser_1.TokenType.ExamplesLine);
    }
    match_StepLine(token) {
        return this.matchTitleLine(KeywordPrefix.BULLET, this.nonStarStepKeywords, '', token, Parser_1.TokenType.StepLine);
    }
    matchTitleLine(prefix, keywords, keywordSuffix, token, matchedType) {
        const regexp = new RegExp(`${prefix}(${keywords.map(escapeRegExp).join('|')})${keywordSuffix}(.*)`);
        const match = token.line.match(regexp);
        let indent = token.line.indent;
        let result = false;
        if (match) {
            token.matchedType = matchedType;
            token.matchedKeyword = match[2];
            if (match[2] in this.keywordTypesMap) {
                // only set the keyword type if this is a step keyword
                if (this.keywordTypesMap[match[2]].length > 1) {
                    token.matchedKeywordType = messages.StepKeywordType.UNKNOWN;
                }
                else {
                    token.matchedKeywordType = this.keywordTypesMap[match[2]][0];
                }
            }
            token.matchedText = match[3].trim();
            indent += match[1].length;
            result = true;
        }
        return this.setTokenMatched(token, indent, result);
    }
    setTokenMatched(token, indent, matched) {
        token.matchedGherkinDialect = this.dialectName;
        token.matchedIndent = indent !== null ? indent : token.line == null ? 0 : token.line.indent;
        token.location.column = token.matchedIndent + 1;
        return matched;
    }
    match_TableRow(token) {
        // Gherkin tables must be indented 2-5 spaces in order to be distinguidedn from non-Gherkin tables
        if (token.line.lineText.match(/^\s\s\s?\s?\s?\|/)) {
            const tableCells = token.line.getTableCells();
            if (this.isGfmTableSeparator(tableCells))
                return false;
            token.matchedKeyword = '|';
            token.matchedType = Parser_1.TokenType.TableRow;
            token.matchedItems = tableCells;
            return true;
        }
        return false;
    }
    isGfmTableSeparator(tableCells) {
        const separatorValues = tableCells
            .map((item) => item.text)
            .filter((value) => value.match(/^:?-+:?$/));
        return separatorValues.length > 0;
    }
    match_TagLine(token) {
        const tags = [];
        let m;
        const re = /`(@[^`]+)`/g;
        do {
            m = re.exec(token.line.trimmedLineText);
            if (m) {
                tags.push({
                    column: token.line.indent + m.index + 2,
                    text: m[1],
                });
            }
        } while (m);
        if (tags.length === 0)
            return false;
        token.matchedType = Parser_1.TokenType.TagLine;
        token.matchedItems = tags;
        return true;
    }
    reset() {
        if (this.dialectName !== this.defaultDialectName) {
            this.changeDialect(this.defaultDialectName);
        }
        this.activeDocStringSeparator = DEFAULT_DOC_STRING_SEPARATOR;
    }
}
exports.default = GherkinInMarkdownTokenMatcher;
window.GherkinInMarkdownTokenMatcher = GherkinInMarkdownTokenMatcher;

var KeywordPrefix;
(function (KeywordPrefix) {
    // https://spec.commonmark.org/0.29/#bullet-list-marker
    KeywordPrefix["BULLET"] = "^(\\s*[*+-]\\s*)";
    KeywordPrefix["HEADER"] = "^(#{1,6}\\s)";
})(KeywordPrefix || (KeywordPrefix = {}));
// https://stackoverflow.com/questions/3115150/how-to-escape-regular-expression-special-characters-using-javascript
function escapeRegExp(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

},{"./Errors":3,"./Parser":7,"./gherkin-languages.json":12,"@cucumber/messages":19}],6:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const countSymbols_1 = __importDefault(require("./countSymbols"));
class GherkinLine {
    constructor(lineText, lineNumber) {
        this.lineText = lineText;
        this.lineNumber = lineNumber;
        this.trimmedLineText = lineText.replace(/^\s+/g, ''); // ltrim
        this.isEmpty = this.trimmedLineText.length === 0;
        this.indent = (0, countSymbols_1.default)(lineText) - (0, countSymbols_1.default)(this.trimmedLineText);
    }
    startsWith(prefix) {
        return this.trimmedLineText.indexOf(prefix) === 0;
    }
    startsWithTitleKeyword(keyword) {
        return this.startsWith(keyword + ':'); // The C# impl is more complicated. Find out why.
    }
    match(regexp) {
        return this.trimmedLineText.match(regexp);
    }
    getLineText(indentToRemove) {
        if (indentToRemove < 0 || indentToRemove > this.indent) {
            return this.trimmedLineText;
        }
        else {
            return this.lineText.substring(indentToRemove);
        }
    }
    getRestTrimmed(length) {
        return this.trimmedLineText.substring(length).trim();
    }
    getTableCells() {
        const cells = [];
        let col = 0;
        let startCol = col + 1;
        let cell = '';
        let firstCell = true;
        while (col < this.trimmedLineText.length) {
            let chr = this.trimmedLineText[col];
            col++;
            if (chr === '|') {
                if (firstCell) {
                    // First cell (content before the first |) is skipped
                    firstCell = false;
                }
                else {
                    // Keeps newlines
                    const trimmedLeft = cell.replace(/^[ \t\v\f\r\u0085\u00A0]*/g, '');
                    const trimmed = trimmedLeft.replace(/[ \t\v\f\r\u0085\u00A0]*$/g, '');
                    const cellIndent = cell.length - trimmedLeft.length;
                    const span = {
                        column: this.indent + startCol + cellIndent,
                        text: trimmed,
                    };
                    cells.push(span);
                }
                cell = '';
                startCol = col + 1;
            }
            else if (chr === '\\') {
                chr = this.trimmedLineText[col];
                col += 1;
                if (chr === 'n') {
                    cell += '\n';
                }
                else {
                    if (chr !== '|' && chr !== '\\') {
                        cell += '\\';
                    }
                    cell += chr;
                }
            }
            else {
                cell += chr;
            }
        }
        return cells;
    }
}
exports.default = GherkinLine;
module.exports = GherkinLine;
window.GherkinLine = GherkinLine;

},{"./countSymbols":10}],7:[function(require,module,exports){
"use strict";
// This file is generated. Do not edit! Edit gherkin-javascript.razor instead.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleType = exports.TokenType = exports.Token = void 0;
const Errors_1 = require("./Errors");
const TokenExceptions_1 = require("./TokenExceptions");
const TokenScanner_1 = __importDefault(require("./TokenScanner"));
const GherkinLine_1 = __importDefault(require("./GherkinLine"));
class Token {
    constructor(line, location) {
        this.line = line;
        this.location = location;
        this.isEof = !line;
    }
    getTokenValue() {
        return this.isEof ? 'EOF' : this.line.getLineText(-1);
    }
    detach() {
        // TODO: Detach line, but is this really needed?
    }
}
exports.Token = Token;
var TokenType;
(function (TokenType) {
    TokenType[TokenType["None"] = 0] = "None";
    TokenType[TokenType["EOF"] = 1] = "EOF";
    TokenType[TokenType["Empty"] = 2] = "Empty";
    TokenType[TokenType["Comment"] = 3] = "Comment";
    TokenType[TokenType["TagLine"] = 4] = "TagLine";
    TokenType[TokenType["FeatureLine"] = 5] = "FeatureLine";
    TokenType[TokenType["RuleLine"] = 6] = "RuleLine";
    TokenType[TokenType["BackgroundLine"] = 7] = "BackgroundLine";
    TokenType[TokenType["ScenarioLine"] = 8] = "ScenarioLine";
    TokenType[TokenType["ExamplesLine"] = 9] = "ExamplesLine";
    TokenType[TokenType["StepLine"] = 10] = "StepLine";
    TokenType[TokenType["DocStringSeparator"] = 11] = "DocStringSeparator";
    TokenType[TokenType["TableRow"] = 12] = "TableRow";
    TokenType[TokenType["Language"] = 13] = "Language";
    TokenType[TokenType["Other"] = 14] = "Other";
})(TokenType || (exports.TokenType = TokenType = {}));
var RuleType;
(function (RuleType) {
    RuleType[RuleType["None"] = 0] = "None";
    RuleType[RuleType["_EOF"] = 1] = "_EOF";
    RuleType[RuleType["_Empty"] = 2] = "_Empty";
    RuleType[RuleType["_Comment"] = 3] = "_Comment";
    RuleType[RuleType["_TagLine"] = 4] = "_TagLine";
    RuleType[RuleType["_FeatureLine"] = 5] = "_FeatureLine";
    RuleType[RuleType["_RuleLine"] = 6] = "_RuleLine";
    RuleType[RuleType["_BackgroundLine"] = 7] = "_BackgroundLine";
    RuleType[RuleType["_ScenarioLine"] = 8] = "_ScenarioLine";
    RuleType[RuleType["_ExamplesLine"] = 9] = "_ExamplesLine";
    RuleType[RuleType["_StepLine"] = 10] = "_StepLine";
    RuleType[RuleType["_DocStringSeparator"] = 11] = "_DocStringSeparator";
    RuleType[RuleType["_TableRow"] = 12] = "_TableRow";
    RuleType[RuleType["_Language"] = 13] = "_Language";
    RuleType[RuleType["_Other"] = 14] = "_Other";
    RuleType[RuleType["GherkinDocument"] = 15] = "GherkinDocument";
    RuleType[RuleType["Feature"] = 16] = "Feature";
    RuleType[RuleType["FeatureHeader"] = 17] = "FeatureHeader";
    RuleType[RuleType["Rule"] = 18] = "Rule";
    RuleType[RuleType["RuleHeader"] = 19] = "RuleHeader";
    RuleType[RuleType["Background"] = 20] = "Background";
    RuleType[RuleType["ScenarioDefinition"] = 21] = "ScenarioDefinition";
    RuleType[RuleType["Scenario"] = 22] = "Scenario";
    RuleType[RuleType["ExamplesDefinition"] = 23] = "ExamplesDefinition";
    RuleType[RuleType["Examples"] = 24] = "Examples";
    RuleType[RuleType["ExamplesTable"] = 25] = "ExamplesTable";
    RuleType[RuleType["Step"] = 26] = "Step";
    RuleType[RuleType["StepArg"] = 27] = "StepArg";
    RuleType[RuleType["DataTable"] = 28] = "DataTable";
    RuleType[RuleType["DocString"] = 29] = "DocString";
    RuleType[RuleType["Tags"] = 30] = "Tags";
    RuleType[RuleType["DescriptionHelper"] = 31] = "DescriptionHelper";
    RuleType[RuleType["Description"] = 32] = "Description";
})(RuleType || (exports.RuleType = RuleType = {}));
class Parser {
    constructor(builder, tokenMatcher) {
        this.builder = builder;
        this.tokenMatcher = tokenMatcher;
        this.stopAtFirstError = false;
    }
    parse(gherkinSource) {
        const tokenScanner = new TokenScanner_1.default(gherkinSource, (line, location) => {
            const gherkinLine = line === null || line === undefined
                ? null
                : new GherkinLine_1.default(line, location.line);
            return new Token(gherkinLine, location);
        });
        this.builder.reset();
        this.tokenMatcher.reset();
        this.context = {
            tokenScanner,
            tokenQueue: [],
            errors: [],
        };
        this.startRule(this.context, RuleType.GherkinDocument);
        let state = 0;
        let token = null;
        while (true) {
            token = this.readToken(this.context);
            state = this.matchToken(state, token, this.context);
            if (token.isEof)
                break;
        }
        this.endRule(this.context);
        if (this.context.errors.length > 0) {
            throw Errors_1.CompositeParserException.create(this.context.errors);
        }
        return this.getResult();
    }
    addError(context, error) {
        if (!context.errors.map(e => { return e.message; }).includes(error.message)) {
            context.errors.push(error);
            if (context.errors.length > 10)
                throw Errors_1.CompositeParserException.create(context.errors);
        }
    }
    startRule(context, ruleType) {
        this.handleAstError(context, () => this.builder.startRule(ruleType));
    }
    endRule(context) {
        this.handleAstError(context, () => this.builder.endRule());
    }
    build(context, token) {
        this.handleAstError(context, () => this.builder.build(token));
    }
    getResult() {
        return this.builder.getResult();
    }
    handleAstError(context, action) {
        this.handleExternalError(context, true, action);
    }
    handleExternalError(context, defaultValue, action) {
        if (this.stopAtFirstError)
            return action();
        try {
            return action();
        }
        catch (e) {
            if (e instanceof Errors_1.CompositeParserException) {
                e.errors.forEach((error) => this.addError(context, error));
            }
            else if (e instanceof Errors_1.ParserException ||
                e instanceof Errors_1.AstBuilderException ||
                e instanceof TokenExceptions_1.UnexpectedTokenException ||
                e instanceof Errors_1.NoSuchLanguageException) {
                this.addError(context, e);
            }
            else {
                throw e;
            }
        }
        return defaultValue;
    }
    readToken(context) {
        return context.tokenQueue.length > 0
            ? context.tokenQueue.shift()
            : context.tokenScanner.read();
    }
    matchToken(state, token, context) {
        switch (state) {
            case 0:
                return this.matchTokenAt_0(token, context);
            case 1:
                return this.matchTokenAt_1(token, context);
            case 2:
                return this.matchTokenAt_2(token, context);
            case 3:
                return this.matchTokenAt_3(token, context);
            case 4:
                return this.matchTokenAt_4(token, context);
            case 5:
                return this.matchTokenAt_5(token, context);
            case 6:
                return this.matchTokenAt_6(token, context);
            case 7:
                return this.matchTokenAt_7(token, context);
            case 8:
                return this.matchTokenAt_8(token, context);
            case 9:
                return this.matchTokenAt_9(token, context);
            case 10:
                return this.matchTokenAt_10(token, context);
            case 11:
                return this.matchTokenAt_11(token, context);
            case 12:
                return this.matchTokenAt_12(token, context);
            case 13:
                return this.matchTokenAt_13(token, context);
            case 14:
                return this.matchTokenAt_14(token, context);
            case 15:
                return this.matchTokenAt_15(token, context);
            case 16:
                return this.matchTokenAt_16(token, context);
            case 17:
                return this.matchTokenAt_17(token, context);
            case 18:
                return this.matchTokenAt_18(token, context);
            case 19:
                return this.matchTokenAt_19(token, context);
            case 20:
                return this.matchTokenAt_20(token, context);
            case 21:
                return this.matchTokenAt_21(token, context);
            case 22:
                return this.matchTokenAt_22(token, context);
            case 23:
                return this.matchTokenAt_23(token, context);
            case 24:
                return this.matchTokenAt_24(token, context);
            case 25:
                return this.matchTokenAt_25(token, context);
            case 26:
                return this.matchTokenAt_26(token, context);
            case 27:
                return this.matchTokenAt_27(token, context);
            case 28:
                return this.matchTokenAt_28(token, context);
            case 29:
                return this.matchTokenAt_29(token, context);
            case 30:
                return this.matchTokenAt_30(token, context);
            case 31:
                return this.matchTokenAt_31(token, context);
            case 32:
                return this.matchTokenAt_32(token, context);
            case 33:
                return this.matchTokenAt_33(token, context);
            case 34:
                return this.matchTokenAt_34(token, context);
            case 35:
                return this.matchTokenAt_35(token, context);
            case 36:
                return this.matchTokenAt_36(token, context);
            case 37:
                return this.matchTokenAt_37(token, context);
            case 38:
                return this.matchTokenAt_38(token, context);
            case 39:
                return this.matchTokenAt_39(token, context);
            case 40:
                return this.matchTokenAt_40(token, context);
            case 41:
                return this.matchTokenAt_41(token, context);
            case 43:
                return this.matchTokenAt_43(token, context);
            case 44:
                return this.matchTokenAt_44(token, context);
            case 45:
                return this.matchTokenAt_45(token, context);
            case 46:
                return this.matchTokenAt_46(token, context);
            case 47:
                return this.matchTokenAt_47(token, context);
            case 48:
                return this.matchTokenAt_48(token, context);
            case 49:
                return this.matchTokenAt_49(token, context);
            case 50:
                return this.matchTokenAt_50(token, context);
            default:
                throw new Error("Unknown state: " + state);
        }
    }
    // Start
    matchTokenAt_0(token, context) {
        if (this.match_EOF(context, token)) {
            this.build(context, token);
            return 42;
        }
        if (this.match_Language(context, token)) {
            this.startRule(context, RuleType.Feature);
            this.startRule(context, RuleType.FeatureHeader);
            this.build(context, token);
            return 1;
        }
        if (this.match_TagLine(context, token)) {
            this.startRule(context, RuleType.Feature);
            this.startRule(context, RuleType.FeatureHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 2;
        }
        if (this.match_FeatureLine(context, token)) {
            this.startRule(context, RuleType.Feature);
            this.startRule(context, RuleType.FeatureHeader);
            this.build(context, token);
            return 3;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 0;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 0;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#Language", "#TagLine", "#FeatureLine", "#Comment", "#Empty"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 0;
    }
    // GherkinDocument:0>Feature:0>FeatureHeader:0>#Language:0
    matchTokenAt_1(token, context) {
        if (this.match_TagLine(context, token)) {
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 2;
        }
        if (this.match_FeatureLine(context, token)) {
            this.build(context, token);
            return 3;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 1;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 1;
        }
        token.detach();
        const expectedTokens = ["#TagLine", "#FeatureLine", "#Comment", "#Empty"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 1;
    }
    // GherkinDocument:0>Feature:0>FeatureHeader:1>Tags:0>#TagLine:0
    matchTokenAt_2(token, context) {
        if (this.match_TagLine(context, token)) {
            this.build(context, token);
            return 2;
        }
        if (this.match_FeatureLine(context, token)) {
            this.endRule(context);
            this.build(context, token);
            return 3;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 2;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 2;
        }
        token.detach();
        const expectedTokens = ["#TagLine", "#FeatureLine", "#Comment", "#Empty"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 2;
    }
    // GherkinDocument:0>Feature:0>FeatureHeader:2>#FeatureLine:0
    matchTokenAt_3(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 3;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 5;
        }
        if (this.match_BackgroundLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.Background);
            this.build(context, token);
            return 6;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 11;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 12;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Other(context, token)) {
            this.startRule(context, RuleType.Description);
            this.build(context, token);
            return 4;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#Empty", "#Comment", "#BackgroundLine", "#TagLine", "#ScenarioLine", "#RuleLine", "#Other"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 3;
    }
    // GherkinDocument:0>Feature:0>FeatureHeader:3>DescriptionHelper:1>Description:0>#Other:0
    matchTokenAt_4(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_Comment(context, token)) {
            this.endRule(context);
            this.build(context, token);
            return 5;
        }
        if (this.match_BackgroundLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Background);
            this.build(context, token);
            return 6;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 11;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 12;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Other(context, token)) {
            this.build(context, token);
            return 4;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#Comment", "#BackgroundLine", "#TagLine", "#ScenarioLine", "#RuleLine", "#Other"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 4;
    }
    // GherkinDocument:0>Feature:0>FeatureHeader:3>DescriptionHelper:2>#Comment:0
    matchTokenAt_5(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 5;
        }
        if (this.match_BackgroundLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.Background);
            this.build(context, token);
            return 6;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 11;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 12;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 5;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#Comment", "#BackgroundLine", "#TagLine", "#ScenarioLine", "#RuleLine", "#Empty"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 5;
    }
    // GherkinDocument:0>Feature:1>Background:0>#BackgroundLine:0
    matchTokenAt_6(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 6;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 8;
        }
        if (this.match_StepLine(context, token)) {
            this.startRule(context, RuleType.Step);
            this.build(context, token);
            return 9;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 11;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 12;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Other(context, token)) {
            this.startRule(context, RuleType.Description);
            this.build(context, token);
            return 7;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#Empty", "#Comment", "#StepLine", "#TagLine", "#ScenarioLine", "#RuleLine", "#Other"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 6;
    }
    // GherkinDocument:0>Feature:1>Background:1>DescriptionHelper:1>Description:0>#Other:0
    matchTokenAt_7(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_Comment(context, token)) {
            this.endRule(context);
            this.build(context, token);
            return 8;
        }
        if (this.match_StepLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.Step);
            this.build(context, token);
            return 9;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 11;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 12;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Other(context, token)) {
            this.build(context, token);
            return 7;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#Comment", "#StepLine", "#TagLine", "#ScenarioLine", "#RuleLine", "#Other"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 7;
    }
    // GherkinDocument:0>Feature:1>Background:1>DescriptionHelper:2>#Comment:0
    matchTokenAt_8(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 8;
        }
        if (this.match_StepLine(context, token)) {
            this.startRule(context, RuleType.Step);
            this.build(context, token);
            return 9;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 11;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 12;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 8;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#Comment", "#StepLine", "#TagLine", "#ScenarioLine", "#RuleLine", "#Empty"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 8;
    }
    // GherkinDocument:0>Feature:1>Background:2>Step:0>#StepLine:0
    matchTokenAt_9(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_TableRow(context, token)) {
            this.startRule(context, RuleType.DataTable);
            this.build(context, token);
            return 10;
        }
        if (this.match_DocStringSeparator(context, token)) {
            this.startRule(context, RuleType.DocString);
            this.build(context, token);
            return 49;
        }
        if (this.match_StepLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.Step);
            this.build(context, token);
            return 9;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 11;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 12;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 9;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 9;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#TableRow", "#DocStringSeparator", "#StepLine", "#TagLine", "#ScenarioLine", "#RuleLine", "#Comment", "#Empty"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 9;
    }
    // GherkinDocument:0>Feature:1>Background:2>Step:1>StepArg:0>__alt0:0>DataTable:0>#TableRow:0
    matchTokenAt_10(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_TableRow(context, token)) {
            this.build(context, token);
            return 10;
        }
        if (this.match_StepLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Step);
            this.build(context, token);
            return 9;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 11;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 12;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 10;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 10;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#TableRow", "#StepLine", "#TagLine", "#ScenarioLine", "#RuleLine", "#Comment", "#Empty"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 10;
    }
    // GherkinDocument:0>Feature:2>ScenarioDefinition:0>Tags:0>#TagLine:0
    matchTokenAt_11(token, context) {
        if (this.match_TagLine(context, token)) {
            this.build(context, token);
            return 11;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 12;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 11;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 11;
        }
        token.detach();
        const expectedTokens = ["#TagLine", "#ScenarioLine", "#Comment", "#Empty"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 11;
    }
    // GherkinDocument:0>Feature:2>ScenarioDefinition:1>Scenario:0>#ScenarioLine:0
    matchTokenAt_12(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 12;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 14;
        }
        if (this.match_StepLine(context, token)) {
            this.startRule(context, RuleType.Step);
            this.build(context, token);
            return 15;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_1(context, token)) {
                this.startRule(context, RuleType.ExamplesDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 17;
            }
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 11;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ExamplesLine(context, token)) {
            this.startRule(context, RuleType.ExamplesDefinition);
            this.startRule(context, RuleType.Examples);
            this.build(context, token);
            return 18;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 12;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Other(context, token)) {
            this.startRule(context, RuleType.Description);
            this.build(context, token);
            return 13;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#Empty", "#Comment", "#StepLine", "#TagLine", "#ExamplesLine", "#ScenarioLine", "#RuleLine", "#Other"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 12;
    }
    // GherkinDocument:0>Feature:2>ScenarioDefinition:1>Scenario:1>DescriptionHelper:1>Description:0>#Other:0
    matchTokenAt_13(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_Comment(context, token)) {
            this.endRule(context);
            this.build(context, token);
            return 14;
        }
        if (this.match_StepLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.Step);
            this.build(context, token);
            return 15;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_1(context, token)) {
                this.endRule(context);
                this.startRule(context, RuleType.ExamplesDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 17;
            }
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 11;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ExamplesLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.ExamplesDefinition);
            this.startRule(context, RuleType.Examples);
            this.build(context, token);
            return 18;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 12;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Other(context, token)) {
            this.build(context, token);
            return 13;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#Comment", "#StepLine", "#TagLine", "#ExamplesLine", "#ScenarioLine", "#RuleLine", "#Other"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 13;
    }
    // GherkinDocument:0>Feature:2>ScenarioDefinition:1>Scenario:1>DescriptionHelper:2>#Comment:0
    matchTokenAt_14(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 14;
        }
        if (this.match_StepLine(context, token)) {
            this.startRule(context, RuleType.Step);
            this.build(context, token);
            return 15;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_1(context, token)) {
                this.startRule(context, RuleType.ExamplesDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 17;
            }
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 11;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ExamplesLine(context, token)) {
            this.startRule(context, RuleType.ExamplesDefinition);
            this.startRule(context, RuleType.Examples);
            this.build(context, token);
            return 18;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 12;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 14;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#Comment", "#StepLine", "#TagLine", "#ExamplesLine", "#ScenarioLine", "#RuleLine", "#Empty"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 14;
    }
    // GherkinDocument:0>Feature:2>ScenarioDefinition:1>Scenario:2>Step:0>#StepLine:0
    matchTokenAt_15(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_TableRow(context, token)) {
            this.startRule(context, RuleType.DataTable);
            this.build(context, token);
            return 16;
        }
        if (this.match_DocStringSeparator(context, token)) {
            this.startRule(context, RuleType.DocString);
            this.build(context, token);
            return 47;
        }
        if (this.match_StepLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.Step);
            this.build(context, token);
            return 15;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_1(context, token)) {
                this.endRule(context);
                this.startRule(context, RuleType.ExamplesDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 17;
            }
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 11;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ExamplesLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.ExamplesDefinition);
            this.startRule(context, RuleType.Examples);
            this.build(context, token);
            return 18;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 12;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 15;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 15;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#TableRow", "#DocStringSeparator", "#StepLine", "#TagLine", "#ExamplesLine", "#ScenarioLine", "#RuleLine", "#Comment", "#Empty"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 15;
    }
    // GherkinDocument:0>Feature:2>ScenarioDefinition:1>Scenario:2>Step:1>StepArg:0>__alt0:0>DataTable:0>#TableRow:0
    matchTokenAt_16(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_TableRow(context, token)) {
            this.build(context, token);
            return 16;
        }
        if (this.match_StepLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Step);
            this.build(context, token);
            return 15;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_1(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ExamplesDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 17;
            }
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 11;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ExamplesLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ExamplesDefinition);
            this.startRule(context, RuleType.Examples);
            this.build(context, token);
            return 18;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 12;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 16;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 16;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#TableRow", "#StepLine", "#TagLine", "#ExamplesLine", "#ScenarioLine", "#RuleLine", "#Comment", "#Empty"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 16;
    }
    // GherkinDocument:0>Feature:2>ScenarioDefinition:1>Scenario:3>ExamplesDefinition:0>Tags:0>#TagLine:0
    matchTokenAt_17(token, context) {
        if (this.match_TagLine(context, token)) {
            this.build(context, token);
            return 17;
        }
        if (this.match_ExamplesLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.Examples);
            this.build(context, token);
            return 18;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 17;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 17;
        }
        token.detach();
        const expectedTokens = ["#TagLine", "#ExamplesLine", "#Comment", "#Empty"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 17;
    }
    // GherkinDocument:0>Feature:2>ScenarioDefinition:1>Scenario:3>ExamplesDefinition:1>Examples:0>#ExamplesLine:0
    matchTokenAt_18(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 18;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 20;
        }
        if (this.match_TableRow(context, token)) {
            this.startRule(context, RuleType.ExamplesTable);
            this.build(context, token);
            return 21;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_1(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ExamplesDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 17;
            }
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 11;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ExamplesLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ExamplesDefinition);
            this.startRule(context, RuleType.Examples);
            this.build(context, token);
            return 18;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 12;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Other(context, token)) {
            this.startRule(context, RuleType.Description);
            this.build(context, token);
            return 19;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#Empty", "#Comment", "#TableRow", "#TagLine", "#ExamplesLine", "#ScenarioLine", "#RuleLine", "#Other"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 18;
    }
    // GherkinDocument:0>Feature:2>ScenarioDefinition:1>Scenario:3>ExamplesDefinition:1>Examples:1>DescriptionHelper:1>Description:0>#Other:0
    matchTokenAt_19(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_Comment(context, token)) {
            this.endRule(context);
            this.build(context, token);
            return 20;
        }
        if (this.match_TableRow(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.ExamplesTable);
            this.build(context, token);
            return 21;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_1(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ExamplesDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 17;
            }
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 11;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ExamplesLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ExamplesDefinition);
            this.startRule(context, RuleType.Examples);
            this.build(context, token);
            return 18;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 12;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Other(context, token)) {
            this.build(context, token);
            return 19;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#Comment", "#TableRow", "#TagLine", "#ExamplesLine", "#ScenarioLine", "#RuleLine", "#Other"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 19;
    }
    // GherkinDocument:0>Feature:2>ScenarioDefinition:1>Scenario:3>ExamplesDefinition:1>Examples:1>DescriptionHelper:2>#Comment:0
    matchTokenAt_20(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 20;
        }
        if (this.match_TableRow(context, token)) {
            this.startRule(context, RuleType.ExamplesTable);
            this.build(context, token);
            return 21;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_1(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ExamplesDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 17;
            }
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 11;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ExamplesLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ExamplesDefinition);
            this.startRule(context, RuleType.Examples);
            this.build(context, token);
            return 18;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 12;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 20;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#Comment", "#TableRow", "#TagLine", "#ExamplesLine", "#ScenarioLine", "#RuleLine", "#Empty"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 20;
    }
    // GherkinDocument:0>Feature:2>ScenarioDefinition:1>Scenario:3>ExamplesDefinition:1>Examples:2>ExamplesTable:0>#TableRow:0
    matchTokenAt_21(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_TableRow(context, token)) {
            this.build(context, token);
            return 21;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_1(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ExamplesDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 17;
            }
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 11;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ExamplesLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ExamplesDefinition);
            this.startRule(context, RuleType.Examples);
            this.build(context, token);
            return 18;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 12;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 21;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 21;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#TableRow", "#TagLine", "#ExamplesLine", "#ScenarioLine", "#RuleLine", "#Comment", "#Empty"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 21;
    }
    // GherkinDocument:0>Feature:3>Rule:0>RuleHeader:0>Tags:0>#TagLine:0
    matchTokenAt_22(token, context) {
        if (this.match_TagLine(context, token)) {
            this.build(context, token);
            return 22;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.build(context, token);
            return 23;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 22;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 22;
        }
        token.detach();
        const expectedTokens = ["#TagLine", "#RuleLine", "#Comment", "#Empty"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 22;
    }
    // GherkinDocument:0>Feature:3>Rule:0>RuleHeader:1>#RuleLine:0
    matchTokenAt_23(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 23;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 25;
        }
        if (this.match_BackgroundLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.Background);
            this.build(context, token);
            return 26;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 31;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 32;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Other(context, token)) {
            this.startRule(context, RuleType.Description);
            this.build(context, token);
            return 24;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#Empty", "#Comment", "#BackgroundLine", "#TagLine", "#ScenarioLine", "#RuleLine", "#Other"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 23;
    }
    // GherkinDocument:0>Feature:3>Rule:0>RuleHeader:2>DescriptionHelper:1>Description:0>#Other:0
    matchTokenAt_24(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_Comment(context, token)) {
            this.endRule(context);
            this.build(context, token);
            return 25;
        }
        if (this.match_BackgroundLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Background);
            this.build(context, token);
            return 26;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 31;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 32;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Other(context, token)) {
            this.build(context, token);
            return 24;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#Comment", "#BackgroundLine", "#TagLine", "#ScenarioLine", "#RuleLine", "#Other"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 24;
    }
    // GherkinDocument:0>Feature:3>Rule:0>RuleHeader:2>DescriptionHelper:2>#Comment:0
    matchTokenAt_25(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 25;
        }
        if (this.match_BackgroundLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.Background);
            this.build(context, token);
            return 26;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 31;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 32;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 25;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#Comment", "#BackgroundLine", "#TagLine", "#ScenarioLine", "#RuleLine", "#Empty"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 25;
    }
    // GherkinDocument:0>Feature:3>Rule:1>Background:0>#BackgroundLine:0
    matchTokenAt_26(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 26;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 28;
        }
        if (this.match_StepLine(context, token)) {
            this.startRule(context, RuleType.Step);
            this.build(context, token);
            return 29;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 31;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 32;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Other(context, token)) {
            this.startRule(context, RuleType.Description);
            this.build(context, token);
            return 27;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#Empty", "#Comment", "#StepLine", "#TagLine", "#ScenarioLine", "#RuleLine", "#Other"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 26;
    }
    // GherkinDocument:0>Feature:3>Rule:1>Background:1>DescriptionHelper:1>Description:0>#Other:0
    matchTokenAt_27(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_Comment(context, token)) {
            this.endRule(context);
            this.build(context, token);
            return 28;
        }
        if (this.match_StepLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.Step);
            this.build(context, token);
            return 29;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 31;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 32;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Other(context, token)) {
            this.build(context, token);
            return 27;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#Comment", "#StepLine", "#TagLine", "#ScenarioLine", "#RuleLine", "#Other"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 27;
    }
    // GherkinDocument:0>Feature:3>Rule:1>Background:1>DescriptionHelper:2>#Comment:0
    matchTokenAt_28(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 28;
        }
        if (this.match_StepLine(context, token)) {
            this.startRule(context, RuleType.Step);
            this.build(context, token);
            return 29;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 31;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 32;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 28;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#Comment", "#StepLine", "#TagLine", "#ScenarioLine", "#RuleLine", "#Empty"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 28;
    }
    // GherkinDocument:0>Feature:3>Rule:1>Background:2>Step:0>#StepLine:0
    matchTokenAt_29(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_TableRow(context, token)) {
            this.startRule(context, RuleType.DataTable);
            this.build(context, token);
            return 30;
        }
        if (this.match_DocStringSeparator(context, token)) {
            this.startRule(context, RuleType.DocString);
            this.build(context, token);
            return 45;
        }
        if (this.match_StepLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.Step);
            this.build(context, token);
            return 29;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 31;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 32;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 29;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 29;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#TableRow", "#DocStringSeparator", "#StepLine", "#TagLine", "#ScenarioLine", "#RuleLine", "#Comment", "#Empty"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 29;
    }
    // GherkinDocument:0>Feature:3>Rule:1>Background:2>Step:1>StepArg:0>__alt0:0>DataTable:0>#TableRow:0
    matchTokenAt_30(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_TableRow(context, token)) {
            this.build(context, token);
            return 30;
        }
        if (this.match_StepLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Step);
            this.build(context, token);
            return 29;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 31;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 32;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 30;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 30;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#TableRow", "#StepLine", "#TagLine", "#ScenarioLine", "#RuleLine", "#Comment", "#Empty"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 30;
    }
    // GherkinDocument:0>Feature:3>Rule:2>ScenarioDefinition:0>Tags:0>#TagLine:0
    matchTokenAt_31(token, context) {
        if (this.match_TagLine(context, token)) {
            this.build(context, token);
            return 31;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 32;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 31;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 31;
        }
        token.detach();
        const expectedTokens = ["#TagLine", "#ScenarioLine", "#Comment", "#Empty"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 31;
    }
    // GherkinDocument:0>Feature:3>Rule:2>ScenarioDefinition:1>Scenario:0>#ScenarioLine:0
    matchTokenAt_32(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 32;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 34;
        }
        if (this.match_StepLine(context, token)) {
            this.startRule(context, RuleType.Step);
            this.build(context, token);
            return 35;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_1(context, token)) {
                this.startRule(context, RuleType.ExamplesDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 37;
            }
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 31;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ExamplesLine(context, token)) {
            this.startRule(context, RuleType.ExamplesDefinition);
            this.startRule(context, RuleType.Examples);
            this.build(context, token);
            return 38;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 32;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Other(context, token)) {
            this.startRule(context, RuleType.Description);
            this.build(context, token);
            return 33;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#Empty", "#Comment", "#StepLine", "#TagLine", "#ExamplesLine", "#ScenarioLine", "#RuleLine", "#Other"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 32;
    }
    // GherkinDocument:0>Feature:3>Rule:2>ScenarioDefinition:1>Scenario:1>DescriptionHelper:1>Description:0>#Other:0
    matchTokenAt_33(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_Comment(context, token)) {
            this.endRule(context);
            this.build(context, token);
            return 34;
        }
        if (this.match_StepLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.Step);
            this.build(context, token);
            return 35;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_1(context, token)) {
                this.endRule(context);
                this.startRule(context, RuleType.ExamplesDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 37;
            }
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 31;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ExamplesLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.ExamplesDefinition);
            this.startRule(context, RuleType.Examples);
            this.build(context, token);
            return 38;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 32;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Other(context, token)) {
            this.build(context, token);
            return 33;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#Comment", "#StepLine", "#TagLine", "#ExamplesLine", "#ScenarioLine", "#RuleLine", "#Other"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 33;
    }
    // GherkinDocument:0>Feature:3>Rule:2>ScenarioDefinition:1>Scenario:1>DescriptionHelper:2>#Comment:0
    matchTokenAt_34(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 34;
        }
        if (this.match_StepLine(context, token)) {
            this.startRule(context, RuleType.Step);
            this.build(context, token);
            return 35;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_1(context, token)) {
                this.startRule(context, RuleType.ExamplesDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 37;
            }
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 31;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ExamplesLine(context, token)) {
            this.startRule(context, RuleType.ExamplesDefinition);
            this.startRule(context, RuleType.Examples);
            this.build(context, token);
            return 38;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 32;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 34;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#Comment", "#StepLine", "#TagLine", "#ExamplesLine", "#ScenarioLine", "#RuleLine", "#Empty"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 34;
    }
    // GherkinDocument:0>Feature:3>Rule:2>ScenarioDefinition:1>Scenario:2>Step:0>#StepLine:0
    matchTokenAt_35(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_TableRow(context, token)) {
            this.startRule(context, RuleType.DataTable);
            this.build(context, token);
            return 36;
        }
        if (this.match_DocStringSeparator(context, token)) {
            this.startRule(context, RuleType.DocString);
            this.build(context, token);
            return 43;
        }
        if (this.match_StepLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.Step);
            this.build(context, token);
            return 35;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_1(context, token)) {
                this.endRule(context);
                this.startRule(context, RuleType.ExamplesDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 37;
            }
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 31;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ExamplesLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.ExamplesDefinition);
            this.startRule(context, RuleType.Examples);
            this.build(context, token);
            return 38;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 32;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 35;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 35;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#TableRow", "#DocStringSeparator", "#StepLine", "#TagLine", "#ExamplesLine", "#ScenarioLine", "#RuleLine", "#Comment", "#Empty"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 35;
    }
    // GherkinDocument:0>Feature:3>Rule:2>ScenarioDefinition:1>Scenario:2>Step:1>StepArg:0>__alt0:0>DataTable:0>#TableRow:0
    matchTokenAt_36(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_TableRow(context, token)) {
            this.build(context, token);
            return 36;
        }
        if (this.match_StepLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Step);
            this.build(context, token);
            return 35;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_1(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ExamplesDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 37;
            }
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 31;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ExamplesLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ExamplesDefinition);
            this.startRule(context, RuleType.Examples);
            this.build(context, token);
            return 38;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 32;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 36;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 36;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#TableRow", "#StepLine", "#TagLine", "#ExamplesLine", "#ScenarioLine", "#RuleLine", "#Comment", "#Empty"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 36;
    }
    // GherkinDocument:0>Feature:3>Rule:2>ScenarioDefinition:1>Scenario:3>ExamplesDefinition:0>Tags:0>#TagLine:0
    matchTokenAt_37(token, context) {
        if (this.match_TagLine(context, token)) {
            this.build(context, token);
            return 37;
        }
        if (this.match_ExamplesLine(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.Examples);
            this.build(context, token);
            return 38;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 37;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 37;
        }
        token.detach();
        const expectedTokens = ["#TagLine", "#ExamplesLine", "#Comment", "#Empty"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 37;
    }
    // GherkinDocument:0>Feature:3>Rule:2>ScenarioDefinition:1>Scenario:3>ExamplesDefinition:1>Examples:0>#ExamplesLine:0
    matchTokenAt_38(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 38;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 40;
        }
        if (this.match_TableRow(context, token)) {
            this.startRule(context, RuleType.ExamplesTable);
            this.build(context, token);
            return 41;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_1(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ExamplesDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 37;
            }
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 31;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ExamplesLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ExamplesDefinition);
            this.startRule(context, RuleType.Examples);
            this.build(context, token);
            return 38;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 32;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Other(context, token)) {
            this.startRule(context, RuleType.Description);
            this.build(context, token);
            return 39;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#Empty", "#Comment", "#TableRow", "#TagLine", "#ExamplesLine", "#ScenarioLine", "#RuleLine", "#Other"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 38;
    }
    // GherkinDocument:0>Feature:3>Rule:2>ScenarioDefinition:1>Scenario:3>ExamplesDefinition:1>Examples:1>DescriptionHelper:1>Description:0>#Other:0
    matchTokenAt_39(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_Comment(context, token)) {
            this.endRule(context);
            this.build(context, token);
            return 40;
        }
        if (this.match_TableRow(context, token)) {
            this.endRule(context);
            this.startRule(context, RuleType.ExamplesTable);
            this.build(context, token);
            return 41;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_1(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ExamplesDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 37;
            }
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 31;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ExamplesLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ExamplesDefinition);
            this.startRule(context, RuleType.Examples);
            this.build(context, token);
            return 38;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 32;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Other(context, token)) {
            this.build(context, token);
            return 39;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#Comment", "#TableRow", "#TagLine", "#ExamplesLine", "#ScenarioLine", "#RuleLine", "#Other"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 39;
    }
    // GherkinDocument:0>Feature:3>Rule:2>ScenarioDefinition:1>Scenario:3>ExamplesDefinition:1>Examples:1>DescriptionHelper:2>#Comment:0
    matchTokenAt_40(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 40;
        }
        if (this.match_TableRow(context, token)) {
            this.startRule(context, RuleType.ExamplesTable);
            this.build(context, token);
            return 41;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_1(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ExamplesDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 37;
            }
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 31;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ExamplesLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ExamplesDefinition);
            this.startRule(context, RuleType.Examples);
            this.build(context, token);
            return 38;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 32;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 40;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#Comment", "#TableRow", "#TagLine", "#ExamplesLine", "#ScenarioLine", "#RuleLine", "#Empty"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 40;
    }
    // GherkinDocument:0>Feature:3>Rule:2>ScenarioDefinition:1>Scenario:3>ExamplesDefinition:1>Examples:2>ExamplesTable:0>#TableRow:0
    matchTokenAt_41(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_TableRow(context, token)) {
            this.build(context, token);
            return 41;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_1(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ExamplesDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 37;
            }
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 31;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ExamplesLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ExamplesDefinition);
            this.startRule(context, RuleType.Examples);
            this.build(context, token);
            return 38;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 32;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 41;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 41;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#TableRow", "#TagLine", "#ExamplesLine", "#ScenarioLine", "#RuleLine", "#Comment", "#Empty"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 41;
    }
    // GherkinDocument:0>Feature:3>Rule:2>ScenarioDefinition:1>Scenario:2>Step:1>StepArg:0>__alt0:1>DocString:0>#DocStringSeparator:0
    matchTokenAt_43(token, context) {
        if (this.match_DocStringSeparator(context, token)) {
            this.build(context, token);
            return 44;
        }
        if (this.match_Other(context, token)) {
            this.build(context, token);
            return 43;
        }
        token.detach();
        const expectedTokens = ["#DocStringSeparator", "#Other"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 43;
    }
    // GherkinDocument:0>Feature:3>Rule:2>ScenarioDefinition:1>Scenario:2>Step:1>StepArg:0>__alt0:1>DocString:2>#DocStringSeparator:0
    matchTokenAt_44(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_StepLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Step);
            this.build(context, token);
            return 35;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_1(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ExamplesDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 37;
            }
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 31;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ExamplesLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ExamplesDefinition);
            this.startRule(context, RuleType.Examples);
            this.build(context, token);
            return 38;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 32;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 44;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 44;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#StepLine", "#TagLine", "#ExamplesLine", "#ScenarioLine", "#RuleLine", "#Comment", "#Empty"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 44;
    }
    // GherkinDocument:0>Feature:3>Rule:1>Background:2>Step:1>StepArg:0>__alt0:1>DocString:0>#DocStringSeparator:0
    matchTokenAt_45(token, context) {
        if (this.match_DocStringSeparator(context, token)) {
            this.build(context, token);
            return 46;
        }
        if (this.match_Other(context, token)) {
            this.build(context, token);
            return 45;
        }
        token.detach();
        const expectedTokens = ["#DocStringSeparator", "#Other"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 45;
    }
    // GherkinDocument:0>Feature:3>Rule:1>Background:2>Step:1>StepArg:0>__alt0:1>DocString:2>#DocStringSeparator:0
    matchTokenAt_46(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_StepLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Step);
            this.build(context, token);
            return 29;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 31;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 32;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 46;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 46;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#StepLine", "#TagLine", "#ScenarioLine", "#RuleLine", "#Comment", "#Empty"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 46;
    }
    // GherkinDocument:0>Feature:2>ScenarioDefinition:1>Scenario:2>Step:1>StepArg:0>__alt0:1>DocString:0>#DocStringSeparator:0
    matchTokenAt_47(token, context) {
        if (this.match_DocStringSeparator(context, token)) {
            this.build(context, token);
            return 48;
        }
        if (this.match_Other(context, token)) {
            this.build(context, token);
            return 47;
        }
        token.detach();
        const expectedTokens = ["#DocStringSeparator", "#Other"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 47;
    }
    // GherkinDocument:0>Feature:2>ScenarioDefinition:1>Scenario:2>Step:1>StepArg:0>__alt0:1>DocString:2>#DocStringSeparator:0
    matchTokenAt_48(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_StepLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Step);
            this.build(context, token);
            return 15;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_1(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ExamplesDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 17;
            }
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 11;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ExamplesLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ExamplesDefinition);
            this.startRule(context, RuleType.Examples);
            this.build(context, token);
            return 18;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 12;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 48;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 48;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#StepLine", "#TagLine", "#ExamplesLine", "#ScenarioLine", "#RuleLine", "#Comment", "#Empty"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 48;
    }
    // GherkinDocument:0>Feature:1>Background:2>Step:1>StepArg:0>__alt0:1>DocString:0>#DocStringSeparator:0
    matchTokenAt_49(token, context) {
        if (this.match_DocStringSeparator(context, token)) {
            this.build(context, token);
            return 50;
        }
        if (this.match_Other(context, token)) {
            this.build(context, token);
            return 49;
        }
        token.detach();
        const expectedTokens = ["#DocStringSeparator", "#Other"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 49;
    }
    // GherkinDocument:0>Feature:1>Background:2>Step:1>StepArg:0>__alt0:1>DocString:2>#DocStringSeparator:0
    matchTokenAt_50(token, context) {
        if (this.match_EOF(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.build(context, token);
            return 42;
        }
        if (this.match_StepLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Step);
            this.build(context, token);
            return 9;
        }
        if (this.match_TagLine(context, token)) {
            if (this.lookahead_0(context, token)) {
                this.endRule(context);
                this.endRule(context);
                this.endRule(context);
                this.startRule(context, RuleType.ScenarioDefinition);
                this.startRule(context, RuleType.Tags);
                this.build(context, token);
                return 11;
            }
        }
        if (this.match_TagLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.startRule(context, RuleType.Tags);
            this.build(context, token);
            return 22;
        }
        if (this.match_ScenarioLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.ScenarioDefinition);
            this.startRule(context, RuleType.Scenario);
            this.build(context, token);
            return 12;
        }
        if (this.match_RuleLine(context, token)) {
            this.endRule(context);
            this.endRule(context);
            this.endRule(context);
            this.startRule(context, RuleType.Rule);
            this.startRule(context, RuleType.RuleHeader);
            this.build(context, token);
            return 23;
        }
        if (this.match_Comment(context, token)) {
            this.build(context, token);
            return 50;
        }
        if (this.match_Empty(context, token)) {
            this.build(context, token);
            return 50;
        }
        token.detach();
        const expectedTokens = ["#EOF", "#StepLine", "#TagLine", "#ScenarioLine", "#RuleLine", "#Comment", "#Empty"];
        const error = token.isEof ?
            TokenExceptions_1.UnexpectedEOFException.create(token, expectedTokens) :
            TokenExceptions_1.UnexpectedTokenException.create(token, expectedTokens);
        if (this.stopAtFirstError)
            throw error;
        this.addError(context, error);
        return 50;
    }
    match_EOF(context, token) {
        return this.handleExternalError(context, false, () => this.tokenMatcher.match_EOF(token));
    }
    match_Empty(context, token) {
        if (token.isEof)
            return false;
        return this.handleExternalError(context, false, () => this.tokenMatcher.match_Empty(token));
    }
    match_Comment(context, token) {
        if (token.isEof)
            return false;
        return this.handleExternalError(context, false, () => this.tokenMatcher.match_Comment(token));
    }
    match_TagLine(context, token) {
        if (token.isEof)
            return false;
        return this.handleExternalError(context, false, () => this.tokenMatcher.match_TagLine(token));
    }
    match_FeatureLine(context, token) {
        if (token.isEof)
            return false;
        return this.handleExternalError(context, false, () => this.tokenMatcher.match_FeatureLine(token));
    }
    match_RuleLine(context, token) {
        if (token.isEof)
            return false;
        return this.handleExternalError(context, false, () => this.tokenMatcher.match_RuleLine(token));
    }
    match_BackgroundLine(context, token) {
        if (token.isEof)
            return false;
        return this.handleExternalError(context, false, () => this.tokenMatcher.match_BackgroundLine(token));
    }
    match_ScenarioLine(context, token) {
        if (token.isEof)
            return false;
        return this.handleExternalError(context, false, () => this.tokenMatcher.match_ScenarioLine(token));
    }
    match_ExamplesLine(context, token) {
        if (token.isEof)
            return false;
        return this.handleExternalError(context, false, () => this.tokenMatcher.match_ExamplesLine(token));
    }
    match_StepLine(context, token) {
        if (token.isEof)
            return false;
        return this.handleExternalError(context, false, () => this.tokenMatcher.match_StepLine(token));
    }
    match_DocStringSeparator(context, token) {
        if (token.isEof)
            return false;
        return this.handleExternalError(context, false, () => this.tokenMatcher.match_DocStringSeparator(token));
    }
    match_TableRow(context, token) {
        if (token.isEof)
            return false;
        return this.handleExternalError(context, false, () => this.tokenMatcher.match_TableRow(token));
    }
    match_Language(context, token) {
        if (token.isEof)
            return false;
        return this.handleExternalError(context, false, () => this.tokenMatcher.match_Language(token));
    }
    match_Other(context, token) {
        if (token.isEof)
            return false;
        return this.handleExternalError(context, false, () => this.tokenMatcher.match_Other(token));
    }
    lookahead_0(context, currentToken) {
        currentToken.detach();
        let token;
        const queue = [];
        let match = false;
        do {
            token = this.readToken(this.context);
            token.detach();
            queue.push(token);
            if (false || this.match_ScenarioLine(context, token)) {
                match = true;
                break;
            }
        } while (false || this.match_Empty(context, token) || this.match_Comment(context, token) || this.match_TagLine(context, token));
        context.tokenQueue = context.tokenQueue.concat(queue);
        return match;
    }
    lookahead_1(context, currentToken) {
        currentToken.detach();
        let token;
        const queue = [];
        let match = false;
        do {
            token = this.readToken(this.context);
            token.detach();
            queue.push(token);
            if (false || this.match_ExamplesLine(context, token)) {
                match = true;
                break;
            }
        } while (false || this.match_Empty(context, token) || this.match_Comment(context, token) || this.match_TagLine(context, token));
        context.tokenQueue = context.tokenQueue.concat(queue);
        return match;
    }
}
exports.default = Parser;
window.Parser = Parser;

},{"./Errors":3,"./GherkinLine":6,"./TokenExceptions":8,"./TokenScanner":9}],8:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnexpectedEOFException = exports.UnexpectedTokenException = void 0;
const Errors_1 = require("./Errors");
class UnexpectedTokenException extends Errors_1.GherkinException {
    static create(token, expectedTokenTypes) {
        const message = `expected: ${expectedTokenTypes.join(', ')}, got '${token
            .getTokenValue()
            .trim()}'`;
        const location = tokenLocation(token);
        return this._create(message, location);
    }
}
exports.UnexpectedTokenException = UnexpectedTokenException;
class UnexpectedEOFException extends Errors_1.GherkinException {
    static create(token, expectedTokenTypes) {
        const message = `unexpected end of file, expected: ${expectedTokenTypes.join(', ')}`;
        const location = tokenLocation(token);
        return this._create(message, location);
    }
}
exports.UnexpectedEOFException = UnexpectedEOFException;
function tokenLocation(token) {
    return token.location && token.location.line && token.line && token.line.indent !== undefined
        ? {
            line: token.location.line,
            column: token.line.indent + 1,
        }
        : token.location;
}

},{"./Errors":3}],9:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * The scanner reads a gherkin doc (typically read from a .feature file) and creates a token for each line.
 * The tokens are passed to the parser, which outputs an AST (Abstract Syntax Tree).
 *
 * If the scanner sees a `#` language header, it will reconfigure itself dynamically to look for
 * Gherkin keywords for the associated language. The keywords are defined in gherkin-languages.json.
 */
class TokenScanner {
    constructor(source, makeToken) {
        this.makeToken = makeToken;
        this.lineNumber = 0;
        this.lines = source.split(/\r?\n/);
        if (this.lines.length > 0 && this.lines[this.lines.length - 1].trim() === '') {
            this.lines.pop();
        }
    }
    read() {
        const line = this.lines[this.lineNumber++];
        const location = {
            line: this.lineNumber,
        };
        return this.makeToken(line, location);
    }
}
exports.default = TokenScanner;
window.TokenScanner = TokenScanner;

},{}],10:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// https://mathiasbynens.be/notes/javascript-unicode
const regexAstralSymbols = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
function countSymbols(s) {
    return s.replace(regexAstralSymbols, '_').length;
}
exports.default = countSymbols;
window.countSymbols = countSymbols;

},{}],11:[function(require,module,exports){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Parser_1 = __importDefault(require("./Parser"));
const GherkinClassicTokenMatcher_1 = __importDefault(require("./GherkinClassicTokenMatcher"));
const messages = __importStar(require("@cucumber/messages"));
const compile_1 = __importDefault(require("./pickles/compile"));
const AstBuilder_1 = __importDefault(require("./AstBuilder"));
const makeSourceEnvelope_1 = __importDefault(require("./makeSourceEnvelope"));
const GherkinInMarkdownTokenMatcher_1 = __importDefault(require("./GherkinInMarkdownTokenMatcher"));
function generateMessages(data, uri, mediaType, options) {
    let tokenMatcher;
    switch (mediaType) {
        case messages.SourceMediaType.TEXT_X_CUCUMBER_GHERKIN_PLAIN:
            tokenMatcher = new GherkinClassicTokenMatcher_1.default(options.defaultDialect);
            break;
        case messages.SourceMediaType.TEXT_X_CUCUMBER_GHERKIN_MARKDOWN:
            tokenMatcher = new GherkinInMarkdownTokenMatcher_1.default(options.defaultDialect);
            break;
        default:
            throw new Error(`Unsupported media type: ${mediaType}`);
    }
    const result = [];
    try {
        if (options.includeSource) {
            result.push((0, makeSourceEnvelope_1.default)(data, uri));
        }
        if (!options.includeGherkinDocument && !options.includePickles) {
            return result;
        }
        const parser = new Parser_1.default(new AstBuilder_1.default(options.newId), tokenMatcher);
        parser.stopAtFirstError = false;
        const gherkinDocument = parser.parse(data);
        if (options.includeGherkinDocument) {
            result.push({
                gherkinDocument: { ...gherkinDocument, uri },
            });
        }
        if (options.includePickles) {
            const pickles = (0, compile_1.default)(gherkinDocument, uri, options.newId);
            for (const pickle of pickles) {
                result.push({
                    pickle,
                });
            }
        }
    }
    catch (err) {
        const errors = err.errors || [err];
        for (const error of errors) {
            if (!error.location) {
                // It wasn't a parser error - throw it (this is unexpected)
                throw error;
            }
            result.push({
                parseError: {
                    source: {
                        uri,
                        location: {
                            line: error.location.line,
                            column: error.location.column,
                        },
                    },
                    message: error.message,
                },
            });
        }
    }
    return result;
}
exports.default = generateMessages;
window.generateMessages = generateMessages;

},{"./AstBuilder":1,"./GherkinClassicTokenMatcher":4,"./GherkinInMarkdownTokenMatcher":5,"./Parser":7,"./makeSourceEnvelope":14,"./pickles/compile":15,"@cucumber/messages":19}],12:[function(require,module,exports){
module.exports={
    "af": {
        "and": [
            "* ",
            "En "
        ],
        "background": [
            "Agtergrond"
        ],
        "but": [
            "* ",
            "Maar "
        ],
        "examples": [
            "Voorbeelde"
        ],
        "feature": [
            "Funksie",
            "Besigheid Behoefte",
            "Vermoë"
        ],
        "given": [
            "* ",
            "Gegewe "
        ],
        "name": "Afrikaans",
        "native": "Afrikaans",
        "rule": [
            "Regel"
        ],
        "scenario": [
            "Voorbeeld",
            "Situasie"
        ],
        "scenarioOutline": [
            "Situasie Uiteensetting"
        ],
        "then": [
            "* ",
            "Dan "
        ],
        "when": [
            "* ",
            "Wanneer "
        ]
    },
    "am": {
        "and": [
            "* ",
            "Եվ "
        ],
        "background": [
            "Կոնտեքստ"
        ],
        "but": [
            "* ",
            "Բայց "
        ],
        "examples": [
            "Օրինակներ"
        ],
        "feature": [
            "Ֆունկցիոնալություն",
            "Հատկություն"
        ],
        "given": [
            "* ",
            "Դիցուք "
        ],
        "name": "Armenian",
        "native": "հայերեն",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "Օրինակ",
            "Սցենար"
        ],
        "scenarioOutline": [
            "Սցենարի կառուցվացքը"
        ],
        "then": [
            "* ",
            "Ապա "
        ],
        "when": [
            "* ",
            "Եթե ",
            "Երբ "
        ]
    },
    "an": {
        "and": [
            "* ",
            "Y ",
            "E "
        ],
        "background": [
            "Antecedents"
        ],
        "but": [
            "* ",
            "Pero "
        ],
        "examples": [
            "Eixemplos"
        ],
        "feature": [
            "Caracteristica"
        ],
        "given": [
            "* ",
            "Dau ",
            "Dada ",
            "Daus ",
            "Dadas "
        ],
        "name": "Aragonese",
        "native": "Aragonés",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "Eixemplo",
            "Caso"
        ],
        "scenarioOutline": [
            "Esquema del caso"
        ],
        "then": [
            "* ",
            "Alavez ",
            "Allora ",
            "Antonces "
        ],
        "when": [
            "* ",
            "Cuan "
        ]
    },
    "ar": {
        "and": [
            "* ",
            "و "
        ],
        "background": [
            "الخلفية"
        ],
        "but": [
            "* ",
            "لكن "
        ],
        "examples": [
            "امثلة"
        ],
        "feature": [
            "خاصية"
        ],
        "given": [
            "* ",
            "بفرض "
        ],
        "name": "Arabic",
        "native": "العربية",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "مثال",
            "سيناريو"
        ],
        "scenarioOutline": [
            "سيناريو مخطط"
        ],
        "then": [
            "* ",
            "اذاً ",
            "ثم "
        ],
        "when": [
            "* ",
            "متى ",
            "عندما "
        ]
    },
    "ast": {
        "and": [
            "* ",
            "Y ",
            "Ya "
        ],
        "background": [
            "Antecedentes"
        ],
        "but": [
            "* ",
            "Peru "
        ],
        "examples": [
            "Exemplos"
        ],
        "feature": [
            "Carauterística"
        ],
        "given": [
            "* ",
            "Dáu ",
            "Dada ",
            "Daos ",
            "Daes "
        ],
        "name": "Asturian",
        "native": "asturianu",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "Exemplo",
            "Casu"
        ],
        "scenarioOutline": [
            "Esbozu del casu"
        ],
        "then": [
            "* ",
            "Entós "
        ],
        "when": [
            "* ",
            "Cuando "
        ]
    },
    "az": {
        "and": [
            "* ",
            "Və ",
            "Həm "
        ],
        "background": [
            "Keçmiş",
            "Kontekst"
        ],
        "but": [
            "* ",
            "Amma ",
            "Ancaq "
        ],
        "examples": [
            "Nümunələr"
        ],
        "feature": [
            "Özəllik"
        ],
        "given": [
            "* ",
            "Tutaq ki ",
            "Verilir "
        ],
        "name": "Azerbaijani",
        "native": "Azərbaycanca",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "Nümunə",
            "Ssenari"
        ],
        "scenarioOutline": [
            "Ssenarinin strukturu"
        ],
        "then": [
            "* ",
            "O halda "
        ],
        "when": [
            "* ",
            "Əgər ",
            "Nə vaxt ki "
        ]
    },
    "be": {
        "and": [
            "* ",
            "I ",
            "Ды ",
            "Таксама "
        ],
        "background": [
            "Кантэкст"
        ],
        "but": [
            "* ",
            "Але ",
            "Інакш "
        ],
        "examples": [
            "Прыклады"
        ],
        "feature": [
            "Функцыянальнасць",
            "Фіча"
        ],
        "given": [
            "* ",
            "Няхай ",
            "Дадзена "
        ],
        "name": "Belarusian",
        "native": "Беларуская",
        "rule": [
            "Правілы"
        ],
        "scenario": [
            "Сцэнарый",
            "Cцэнар"
        ],
        "scenarioOutline": [
            "Шаблон сцэнарыя",
            "Узор сцэнара"
        ],
        "then": [
            "* ",
            "Тады "
        ],
        "when": [
            "* ",
            "Калі "
        ]
    },
    "bg": {
        "and": [
            "* ",
            "И "
        ],
        "background": [
            "Предистория"
        ],
        "but": [
            "* ",
            "Но "
        ],
        "examples": [
            "Примери"
        ],
        "feature": [
            "Функционалност"
        ],
        "given": [
            "* ",
            "Дадено "
        ],
        "name": "Bulgarian",
        "native": "български",
        "rule": [
            "Правило"
        ],
        "scenario": [
            "Пример",
            "Сценарий"
        ],
        "scenarioOutline": [
            "Рамка на сценарий"
        ],
        "then": [
            "* ",
            "То "
        ],
        "when": [
            "* ",
            "Когато "
        ]
    },
    "bm": {
        "and": [
            "* ",
            "Dan "
        ],
        "background": [
            "Latar Belakang"
        ],
        "but": [
            "* ",
            "Tetapi ",
            "Tapi "
        ],
        "examples": [
            "Contoh"
        ],
        "feature": [
            "Fungsi"
        ],
        "given": [
            "* ",
            "Diberi ",
            "Bagi "
        ],
        "name": "Malay",
        "native": "Bahasa Melayu",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "Senario",
            "Situasi",
            "Keadaan"
        ],
        "scenarioOutline": [
            "Kerangka Senario",
            "Kerangka Situasi",
            "Kerangka Keadaan",
            "Garis Panduan Senario"
        ],
        "then": [
            "* ",
            "Maka ",
            "Kemudian "
        ],
        "when": [
            "* ",
            "Apabila "
        ]
    },
    "bs": {
        "and": [
            "* ",
            "I ",
            "A "
        ],
        "background": [
            "Pozadina"
        ],
        "but": [
            "* ",
            "Ali "
        ],
        "examples": [
            "Primjeri"
        ],
        "feature": [
            "Karakteristika"
        ],
        "given": [
            "* ",
            "Dato "
        ],
        "name": "Bosnian",
        "native": "Bosanski",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "Primjer",
            "Scenariju",
            "Scenario"
        ],
        "scenarioOutline": [
            "Scenariju-obris",
            "Scenario-outline"
        ],
        "then": [
            "* ",
            "Zatim "
        ],
        "when": [
            "* ",
            "Kada "
        ]
    },
    "ca": {
        "and": [
            "* ",
            "I "
        ],
        "background": [
            "Rerefons",
            "Antecedents"
        ],
        "but": [
            "* ",
            "Però "
        ],
        "examples": [
            "Exemples"
        ],
        "feature": [
            "Característica",
            "Funcionalitat"
        ],
        "given": [
            "* ",
            "Donat ",
            "Donada ",
            "Atès ",
            "Atesa "
        ],
        "name": "Catalan",
        "native": "català",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "Exemple",
            "Escenari"
        ],
        "scenarioOutline": [
            "Esquema de l'escenari"
        ],
        "then": [
            "* ",
            "Aleshores ",
            "Cal "
        ],
        "when": [
            "* ",
            "Quan "
        ]
    },
    "cs": {
        "and": [
            "* ",
            "A také ",
            "A "
        ],
        "background": [
            "Pozadí",
            "Kontext"
        ],
        "but": [
            "* ",
            "Ale "
        ],
        "examples": [
            "Příklady"
        ],
        "feature": [
            "Požadavek"
        ],
        "given": [
            "* ",
            "Pokud ",
            "Za předpokladu "
        ],
        "name": "Czech",
        "native": "Česky",
        "rule": [
            "Pravidlo"
        ],
        "scenario": [
            "Příklad",
            "Scénář"
        ],
        "scenarioOutline": [
            "Náčrt Scénáře",
            "Osnova scénáře"
        ],
        "then": [
            "* ",
            "Pak "
        ],
        "when": [
            "* ",
            "Když "
        ]
    },
    "cy-GB": {
        "and": [
            "* ",
            "A "
        ],
        "background": [
            "Cefndir"
        ],
        "but": [
            "* ",
            "Ond "
        ],
        "examples": [
            "Enghreifftiau"
        ],
        "feature": [
            "Arwedd"
        ],
        "given": [
            "* ",
            "Anrhegedig a "
        ],
        "name": "Welsh",
        "native": "Cymraeg",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "Enghraifft",
            "Scenario"
        ],
        "scenarioOutline": [
            "Scenario Amlinellol"
        ],
        "then": [
            "* ",
            "Yna "
        ],
        "when": [
            "* ",
            "Pryd "
        ]
    },
    "da": {
        "and": [
            "* ",
            "Og "
        ],
        "background": [
            "Baggrund"
        ],
        "but": [
            "* ",
            "Men "
        ],
        "examples": [
            "Eksempler"
        ],
        "feature": [
            "Egenskab"
        ],
        "given": [
            "* ",
            "Givet "
        ],
        "name": "Danish",
        "native": "dansk",
        "rule": [
            "Regel"
        ],
        "scenario": [
            "Eksempel",
            "Scenarie"
        ],
        "scenarioOutline": [
            "Abstrakt Scenario"
        ],
        "then": [
            "* ",
            "Så "
        ],
        "when": [
            "* ",
            "Når "
        ]
    },
    "de": {
        "and": [
            "* ",
            "Und "
        ],
        "background": [
            "Grundlage",
            "Hintergrund",
            "Voraussetzungen",
            "Vorbedingungen"
        ],
        "but": [
            "* ",
            "Aber "
        ],
        "examples": [
            "Beispiele"
        ],
        "feature": [
            "Funktionalität",
            "Funktion"
        ],
        "given": [
            "* ",
            "Angenommen ",
            "Gegeben sei ",
            "Gegeben seien "
        ],
        "name": "German",
        "native": "Deutsch",
        "rule": [
            "Rule",
            "Regel"
        ],
        "scenario": [
            "Beispiel",
            "Szenario"
        ],
        "scenarioOutline": [
            "Szenariogrundriss",
            "Szenarien"
        ],
        "then": [
            "* ",
            "Dann "
        ],
        "when": [
            "* ",
            "Wenn "
        ]
    },
    "el": {
        "and": [
            "* ",
            "Και "
        ],
        "background": [
            "Υπόβαθρο"
        ],
        "but": [
            "* ",
            "Αλλά "
        ],
        "examples": [
            "Παραδείγματα",
            "Σενάρια"
        ],
        "feature": [
            "Δυνατότητα",
            "Λειτουργία"
        ],
        "given": [
            "* ",
            "Δεδομένου "
        ],
        "name": "Greek",
        "native": "Ελληνικά",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "Παράδειγμα",
            "Σενάριο"
        ],
        "scenarioOutline": [
            "Περιγραφή Σεναρίου",
            "Περίγραμμα Σεναρίου"
        ],
        "then": [
            "* ",
            "Τότε "
        ],
        "when": [
            "* ",
            "Όταν "
        ]
    },
    "em": {
        "and": [
            "* ",
            "😂"
        ],
        "background": [
            "💤"
        ],
        "but": [
            "* ",
            "😔"
        ],
        "examples": [
            "📓"
        ],
        "feature": [
            "📚"
        ],
        "given": [
            "* ",
            "😐"
        ],
        "name": "Emoji",
        "native": "😀",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "🥒",
            "📕"
        ],
        "scenarioOutline": [
            "📖"
        ],
        "then": [
            "* ",
            "🙏"
        ],
        "when": [
            "* ",
            "🎬"
        ]
    },
    "en": {
        "and": [
            "* ",
            "And "
        ],
        "background": [
            "Background"
        ],
        "but": [
            "* ",
            "But "
        ],
        "examples": [
            "Examples",
            "Scenarios"
        ],
        "feature": [
            "Feature",
            "Business Need",
            "Ability"
        ],
        "given": [
            "* ",
            "Given "
        ],
        "name": "English",
        "native": "English",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "Example",
            "Scenario"
        ],
        "scenarioOutline": [
            "Scenario Outline",
            "Scenario Template"
        ],
        "then": [
            "* ",
            "Then "
        ],
        "when": [
            "* ",
            "When "
        ]
    },
    "en-Scouse": {
        "and": [
            "* ",
            "An "
        ],
        "background": [
            "Dis is what went down"
        ],
        "but": [
            "* ",
            "Buh "
        ],
        "examples": [
            "Examples"
        ],
        "feature": [
            "Feature"
        ],
        "given": [
            "* ",
            "Givun ",
            "Youse know when youse got "
        ],
        "name": "Scouse",
        "native": "Scouse",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "The thing of it is"
        ],
        "scenarioOutline": [
            "Wharrimean is"
        ],
        "then": [
            "* ",
            "Dun ",
            "Den youse gotta "
        ],
        "when": [
            "* ",
            "Wun ",
            "Youse know like when "
        ]
    },
    "en-au": {
        "and": [
            "* ",
            "Too right "
        ],
        "background": [
            "First off"
        ],
        "but": [
            "* ",
            "Yeah nah "
        ],
        "examples": [
            "You'll wanna"
        ],
        "feature": [
            "Pretty much"
        ],
        "given": [
            "* ",
            "Y'know "
        ],
        "name": "Australian",
        "native": "Australian",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "Awww, look mate"
        ],
        "scenarioOutline": [
            "Reckon it's like"
        ],
        "then": [
            "* ",
            "But at the end of the day I reckon "
        ],
        "when": [
            "* ",
            "It's just unbelievable "
        ]
    },
    "en-lol": {
        "and": [
            "* ",
            "AN "
        ],
        "background": [
            "B4"
        ],
        "but": [
            "* ",
            "BUT "
        ],
        "examples": [
            "EXAMPLZ"
        ],
        "feature": [
            "OH HAI"
        ],
        "given": [
            "* ",
            "I CAN HAZ "
        ],
        "name": "LOLCAT",
        "native": "LOLCAT",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "MISHUN"
        ],
        "scenarioOutline": [
            "MISHUN SRSLY"
        ],
        "then": [
            "* ",
            "DEN "
        ],
        "when": [
            "* ",
            "WEN "
        ]
    },
    "en-old": {
        "and": [
            "* ",
            "Ond ",
            "7 "
        ],
        "background": [
            "Aer",
            "Ær"
        ],
        "but": [
            "* ",
            "Ac "
        ],
        "examples": [
            "Se the",
            "Se þe",
            "Se ðe"
        ],
        "feature": [
            "Hwaet",
            "Hwæt"
        ],
        "given": [
            "* ",
            "Thurh ",
            "Þurh ",
            "Ðurh "
        ],
        "name": "Old English",
        "native": "Englisc",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "Swa"
        ],
        "scenarioOutline": [
            "Swa hwaer swa",
            "Swa hwær swa"
        ],
        "then": [
            "* ",
            "Tha ",
            "Þa ",
            "Ða ",
            "Tha the ",
            "Þa þe ",
            "Ða ðe "
        ],
        "when": [
            "* ",
            "Bæþsealf ",
            "Bæþsealfa ",
            "Bæþsealfe ",
            "Ciricæw ",
            "Ciricæwe ",
            "Ciricæwa "
        ]
    },
    "en-pirate": {
        "and": [
            "* ",
            "Aye "
        ],
        "background": [
            "Yo-ho-ho"
        ],
        "but": [
            "* ",
            "Avast! "
        ],
        "examples": [
            "Dead men tell no tales"
        ],
        "feature": [
            "Ahoy matey!"
        ],
        "given": [
            "* ",
            "Gangway! "
        ],
        "name": "Pirate",
        "native": "Pirate",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "Heave to"
        ],
        "scenarioOutline": [
            "Shiver me timbers"
        ],
        "then": [
            "* ",
            "Let go and haul "
        ],
        "when": [
            "* ",
            "Blimey! "
        ]
    },
    "en-tx": {
        "and": [
            "Come hell or high water "
        ],
        "background": [
            "Lemme tell y'all a story"
        ],
        "but": [
            "Well now hold on, I'll you what "
        ],
        "examples": [
            "Now that's a story longer than a cattle drive in July"
        ],
        "feature": [
            "This ain’t my first rodeo",
            "All gussied up"
        ],
        "given": [
            "Fixin' to ",
            "All git out "
        ],
        "name": "Texas",
        "native": "Texas",
        "rule": [
            "Rule "
        ],
        "scenario": [
            "All hat and no cattle"
        ],
        "scenarioOutline": [
            "Serious as a snake bite",
            "Busy as a hound in flea season"
        ],
        "then": [
            "There’s no tree but bears some fruit "
        ],
        "when": [
            "Quick out of the chute "
        ]
    },
    "eo": {
        "and": [
            "* ",
            "Kaj "
        ],
        "background": [
            "Fono"
        ],
        "but": [
            "* ",
            "Sed "
        ],
        "examples": [
            "Ekzemploj"
        ],
        "feature": [
            "Trajto"
        ],
        "given": [
            "* ",
            "Donitaĵo ",
            "Komence "
        ],
        "name": "Esperanto",
        "native": "Esperanto",
        "rule": [
            "Regulo"
        ],
        "scenario": [
            "Ekzemplo",
            "Scenaro",
            "Kazo"
        ],
        "scenarioOutline": [
            "Konturo de la scenaro",
            "Skizo",
            "Kazo-skizo"
        ],
        "then": [
            "* ",
            "Do "
        ],
        "when": [
            "* ",
            "Se "
        ]
    },
    "es": {
        "and": [
            "* ",
            "Y ",
            "E "
        ],
        "background": [
            "Antecedentes"
        ],
        "but": [
            "* ",
            "Pero "
        ],
        "examples": [
            "Ejemplos"
        ],
        "feature": [
            "Característica",
            "Necesidad del negocio",
            "Requisito"
        ],
        "given": [
            "* ",
            "Dado ",
            "Dada ",
            "Dados ",
            "Dadas "
        ],
        "name": "Spanish",
        "native": "español",
        "rule": [
            "Regla",
            "Regla de negocio"
        ],
        "scenario": [
            "Ejemplo",
            "Escenario"
        ],
        "scenarioOutline": [
            "Esquema del escenario"
        ],
        "then": [
            "* ",
            "Entonces "
        ],
        "when": [
            "* ",
            "Cuando "
        ]
    },
    "et": {
        "and": [
            "* ",
            "Ja "
        ],
        "background": [
            "Taust"
        ],
        "but": [
            "* ",
            "Kuid "
        ],
        "examples": [
            "Juhtumid"
        ],
        "feature": [
            "Omadus"
        ],
        "given": [
            "* ",
            "Eeldades "
        ],
        "name": "Estonian",
        "native": "eesti keel",
        "rule": [
            "Reegel"
        ],
        "scenario": [
            "Juhtum",
            "Stsenaarium"
        ],
        "scenarioOutline": [
            "Raamjuhtum",
            "Raamstsenaarium"
        ],
        "then": [
            "* ",
            "Siis "
        ],
        "when": [
            "* ",
            "Kui "
        ]
    },
    "fa": {
        "and": [
            "* ",
            "و "
        ],
        "background": [
            "زمینه"
        ],
        "but": [
            "* ",
            "اما "
        ],
        "examples": [
            "نمونه ها"
        ],
        "feature": [
            "وِیژگی"
        ],
        "given": [
            "* ",
            "با فرض "
        ],
        "name": "Persian",
        "native": "فارسی",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "مثال",
            "سناریو"
        ],
        "scenarioOutline": [
            "الگوی سناریو"
        ],
        "then": [
            "* ",
            "آنگاه "
        ],
        "when": [
            "* ",
            "هنگامی "
        ]
    },
    "fi": {
        "and": [
            "* ",
            "Ja "
        ],
        "background": [
            "Tausta"
        ],
        "but": [
            "* ",
            "Mutta "
        ],
        "examples": [
            "Tapaukset"
        ],
        "feature": [
            "Ominaisuus"
        ],
        "given": [
            "* ",
            "Oletetaan "
        ],
        "name": "Finnish",
        "native": "suomi",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "Tapaus"
        ],
        "scenarioOutline": [
            "Tapausaihio"
        ],
        "then": [
            "* ",
            "Niin "
        ],
        "when": [
            "* ",
            "Kun "
        ]
    },
    "fr": {
        "and": [
            "* ",
            "Et que ",
            "Et qu'",
            "Et "
        ],
        "background": [
            "Contexte"
        ],
        "but": [
            "* ",
            "Mais que ",
            "Mais qu'",
            "Mais "
        ],
        "examples": [
            "Exemples"
        ],
        "feature": [
            "Fonctionnalité"
        ],
        "given": [
            "* ",
            "Soit ",
            "Sachant que ",
            "Sachant qu'",
            "Sachant ",
            "Etant donné que ",
            "Etant donné qu'",
            "Etant donné ",
            "Etant donnée ",
            "Etant donnés ",
            "Etant données ",
            "Étant donné que ",
            "Étant donné qu'",
            "Étant donné ",
            "Étant donnée ",
            "Étant donnés ",
            "Étant données "
        ],
        "name": "French",
        "native": "français",
        "rule": [
            "Règle"
        ],
        "scenario": [
            "Exemple",
            "Scénario"
        ],
        "scenarioOutline": [
            "Plan du scénario",
            "Plan du Scénario"
        ],
        "then": [
            "* ",
            "Alors ",
            "Donc "
        ],
        "when": [
            "* ",
            "Quand ",
            "Lorsque ",
            "Lorsqu'"
        ]
    },
    "ga": {
        "and": [
            "* ",
            "Agus"
        ],
        "background": [
            "Cúlra"
        ],
        "but": [
            "* ",
            "Ach"
        ],
        "examples": [
            "Samplaí"
        ],
        "feature": [
            "Gné"
        ],
        "given": [
            "* ",
            "Cuir i gcás go",
            "Cuir i gcás nach",
            "Cuir i gcás gur",
            "Cuir i gcás nár"
        ],
        "name": "Irish",
        "native": "Gaeilge",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "Sampla",
            "Cás"
        ],
        "scenarioOutline": [
            "Cás Achomair"
        ],
        "then": [
            "* ",
            "Ansin"
        ],
        "when": [
            "* ",
            "Nuair a",
            "Nuair nach",
            "Nuair ba",
            "Nuair nár"
        ]
    },
    "gj": {
        "and": [
            "* ",
            "અને "
        ],
        "background": [
            "બેકગ્રાઉન્ડ"
        ],
        "but": [
            "* ",
            "પણ "
        ],
        "examples": [
            "ઉદાહરણો"
        ],
        "feature": [
            "લક્ષણ",
            "વ્યાપાર જરૂર",
            "ક્ષમતા"
        ],
        "given": [
            "* ",
            "આપેલ છે "
        ],
        "name": "Gujarati",
        "native": "ગુજરાતી",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "ઉદાહરણ",
            "સ્થિતિ"
        ],
        "scenarioOutline": [
            "પરિદ્દશ્ય રૂપરેખા",
            "પરિદ્દશ્ય ઢાંચો"
        ],
        "then": [
            "* ",
            "પછી "
        ],
        "when": [
            "* ",
            "ક્યારે "
        ]
    },
    "gl": {
        "and": [
            "* ",
            "E "
        ],
        "background": [
            "Contexto"
        ],
        "but": [
            "* ",
            "Mais ",
            "Pero "
        ],
        "examples": [
            "Exemplos"
        ],
        "feature": [
            "Característica"
        ],
        "given": [
            "* ",
            "Dado ",
            "Dada ",
            "Dados ",
            "Dadas "
        ],
        "name": "Galician",
        "native": "galego",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "Exemplo",
            "Escenario"
        ],
        "scenarioOutline": [
            "Esbozo do escenario"
        ],
        "then": [
            "* ",
            "Entón ",
            "Logo "
        ],
        "when": [
            "* ",
            "Cando "
        ]
    },
    "he": {
        "and": [
            "* ",
            "וגם "
        ],
        "background": [
            "רקע"
        ],
        "but": [
            "* ",
            "אבל "
        ],
        "examples": [
            "דוגמאות"
        ],
        "feature": [
            "תכונה"
        ],
        "given": [
            "* ",
            "בהינתן "
        ],
        "name": "Hebrew",
        "native": "עברית",
        "rule": [
            "כלל"
        ],
        "scenario": [
            "דוגמא",
            "תרחיש"
        ],
        "scenarioOutline": [
            "תבנית תרחיש"
        ],
        "then": [
            "* ",
            "אז ",
            "אזי "
        ],
        "when": [
            "* ",
            "כאשר "
        ]
    },
    "hi": {
        "and": [
            "* ",
            "और ",
            "तथा "
        ],
        "background": [
            "पृष्ठभूमि"
        ],
        "but": [
            "* ",
            "पर ",
            "परन्तु ",
            "किन्तु "
        ],
        "examples": [
            "उदाहरण"
        ],
        "feature": [
            "रूप लेख"
        ],
        "given": [
            "* ",
            "अगर ",
            "यदि ",
            "चूंकि "
        ],
        "name": "Hindi",
        "native": "हिंदी",
        "rule": [
            "नियम"
        ],
        "scenario": [
            "परिदृश्य"
        ],
        "scenarioOutline": [
            "परिदृश्य रूपरेखा"
        ],
        "then": [
            "* ",
            "तब ",
            "तदा "
        ],
        "when": [
            "* ",
            "जब ",
            "कदा "
        ]
    },
    "hr": {
        "and": [
            "* ",
            "I "
        ],
        "background": [
            "Pozadina"
        ],
        "but": [
            "* ",
            "Ali "
        ],
        "examples": [
            "Primjeri",
            "Scenariji"
        ],
        "feature": [
            "Osobina",
            "Mogućnost",
            "Mogucnost"
        ],
        "given": [
            "* ",
            "Zadan ",
            "Zadani ",
            "Zadano ",
            "Ukoliko "
        ],
        "name": "Croatian",
        "native": "hrvatski",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "Primjer",
            "Scenarij"
        ],
        "scenarioOutline": [
            "Skica",
            "Koncept"
        ],
        "then": [
            "* ",
            "Onda "
        ],
        "when": [
            "* ",
            "Kada ",
            "Kad "
        ]
    },
    "ht": {
        "and": [
            "* ",
            "Ak ",
            "Epi ",
            "E "
        ],
        "background": [
            "Kontèks",
            "Istorik"
        ],
        "but": [
            "* ",
            "Men "
        ],
        "examples": [
            "Egzanp"
        ],
        "feature": [
            "Karakteristik",
            "Mak",
            "Fonksyonalite"
        ],
        "given": [
            "* ",
            "Sipoze ",
            "Sipoze ke ",
            "Sipoze Ke "
        ],
        "name": "Creole",
        "native": "kreyòl",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "Senaryo"
        ],
        "scenarioOutline": [
            "Plan senaryo",
            "Plan Senaryo",
            "Senaryo deskripsyon",
            "Senaryo Deskripsyon",
            "Dyagram senaryo",
            "Dyagram Senaryo"
        ],
        "then": [
            "* ",
            "Lè sa a ",
            "Le sa a "
        ],
        "when": [
            "* ",
            "Lè ",
            "Le "
        ]
    },
    "hu": {
        "and": [
            "* ",
            "És "
        ],
        "background": [
            "Háttér"
        ],
        "but": [
            "* ",
            "De "
        ],
        "examples": [
            "Példák"
        ],
        "feature": [
            "Jellemző"
        ],
        "given": [
            "* ",
            "Amennyiben ",
            "Adott "
        ],
        "name": "Hungarian",
        "native": "magyar",
        "rule": [
            "Szabály"
        ],
        "scenario": [
            "Példa",
            "Forgatókönyv"
        ],
        "scenarioOutline": [
            "Forgatókönyv vázlat"
        ],
        "then": [
            "* ",
            "Akkor "
        ],
        "when": [
            "* ",
            "Majd ",
            "Ha ",
            "Amikor "
        ]
    },
    "id": {
        "and": [
            "* ",
            "Dan "
        ],
        "background": [
            "Dasar",
            "Latar Belakang"
        ],
        "but": [
            "* ",
            "Tapi ",
            "Tetapi "
        ],
        "examples": [
            "Contoh",
            "Misal"
        ],
        "feature": [
            "Fitur"
        ],
        "given": [
            "* ",
            "Dengan ",
            "Diketahui ",
            "Diasumsikan ",
            "Bila ",
            "Jika "
        ],
        "name": "Indonesian",
        "native": "Bahasa Indonesia",
        "rule": [
            "Rule",
            "Aturan"
        ],
        "scenario": [
            "Skenario"
        ],
        "scenarioOutline": [
            "Skenario konsep",
            "Garis-Besar Skenario"
        ],
        "then": [
            "* ",
            "Maka ",
            "Kemudian "
        ],
        "when": [
            "* ",
            "Ketika "
        ]
    },
    "is": {
        "and": [
            "* ",
            "Og "
        ],
        "background": [
            "Bakgrunnur"
        ],
        "but": [
            "* ",
            "En "
        ],
        "examples": [
            "Dæmi",
            "Atburðarásir"
        ],
        "feature": [
            "Eiginleiki"
        ],
        "given": [
            "* ",
            "Ef "
        ],
        "name": "Icelandic",
        "native": "Íslenska",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "Atburðarás"
        ],
        "scenarioOutline": [
            "Lýsing Atburðarásar",
            "Lýsing Dæma"
        ],
        "then": [
            "* ",
            "Þá "
        ],
        "when": [
            "* ",
            "Þegar "
        ]
    },
    "it": {
        "and": [
            "* ",
            "E ",
            "Ed "
        ],
        "background": [
            "Contesto"
        ],
        "but": [
            "* ",
            "Ma "
        ],
        "examples": [
            "Esempi"
        ],
        "feature": [
            "Funzionalità",
            "Esigenza di Business",
            "Abilità"
        ],
        "given": [
            "* ",
            "Dato ",
            "Data ",
            "Dati ",
            "Date "
        ],
        "name": "Italian",
        "native": "italiano",
        "rule": [
            "Regola"
        ],
        "scenario": [
            "Esempio",
            "Scenario"
        ],
        "scenarioOutline": [
            "Schema dello scenario"
        ],
        "then": [
            "* ",
            "Allora "
        ],
        "when": [
            "* ",
            "Quando "
        ]
    },
    "ja": {
        "and": [
            "* ",
            "且つ",
            "かつ"
        ],
        "background": [
            "背景"
        ],
        "but": [
            "* ",
            "然し",
            "しかし",
            "但し",
            "ただし"
        ],
        "examples": [
            "例",
            "サンプル"
        ],
        "feature": [
            "フィーチャ",
            "機能"
        ],
        "given": [
            "* ",
            "前提"
        ],
        "name": "Japanese",
        "native": "日本語",
        "rule": [
            "ルール"
        ],
        "scenario": [
            "シナリオ"
        ],
        "scenarioOutline": [
            "シナリオアウトライン",
            "シナリオテンプレート",
            "テンプレ",
            "シナリオテンプレ"
        ],
        "then": [
            "* ",
            "ならば"
        ],
        "when": [
            "* ",
            "もし"
        ]
    },
    "jv": {
        "and": [
            "* ",
            "Lan "
        ],
        "background": [
            "Dasar"
        ],
        "but": [
            "* ",
            "Tapi ",
            "Nanging ",
            "Ananging "
        ],
        "examples": [
            "Conto",
            "Contone"
        ],
        "feature": [
            "Fitur"
        ],
        "given": [
            "* ",
            "Nalika ",
            "Nalikaning "
        ],
        "name": "Javanese",
        "native": "Basa Jawa",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "Skenario"
        ],
        "scenarioOutline": [
            "Konsep skenario"
        ],
        "then": [
            "* ",
            "Njuk ",
            "Banjur "
        ],
        "when": [
            "* ",
            "Manawa ",
            "Menawa "
        ]
    },
    "ka": {
        "and": [
            "* ",
            "და ",
            "ასევე "
        ],
        "background": [
            "კონტექსტი"
        ],
        "but": [
            "* ",
            "მაგრამ ",
            "თუმცა "
        ],
        "examples": [
            "მაგალითები"
        ],
        "feature": [
            "თვისება",
            "მოთხოვნა"
        ],
        "given": [
            "* ",
            "მოცემული ",
            "მოცემულია ",
            "ვთქვათ "
        ],
        "name": "Georgian",
        "native": "ქართული",
        "rule": [
            "წესი"
        ],
        "scenario": [
            "მაგალითად",
            "მაგალითი",
            "მაგ",
            "სცენარი"
        ],
        "scenarioOutline": [
            "სცენარის ნიმუში",
            "სცენარის შაბლონი",
            "ნიმუში",
            "შაბლონი"
        ],
        "then": [
            "* ",
            "მაშინ "
        ],
        "when": [
            "* ",
            "როდესაც ",
            "როცა ",
            "როგორც კი ",
            "თუ "
        ]
    },
    "kn": {
        "and": [
            "* ",
            "ಮತ್ತು "
        ],
        "background": [
            "ಹಿನ್ನೆಲೆ"
        ],
        "but": [
            "* ",
            "ಆದರೆ "
        ],
        "examples": [
            "ಉದಾಹರಣೆಗಳು"
        ],
        "feature": [
            "ಹೆಚ್ಚಳ"
        ],
        "given": [
            "* ",
            "ನೀಡಿದ "
        ],
        "name": "Kannada",
        "native": "ಕನ್ನಡ",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "ಉದಾಹರಣೆ",
            "ಕಥಾಸಾರಾಂಶ"
        ],
        "scenarioOutline": [
            "ವಿವರಣೆ"
        ],
        "then": [
            "* ",
            "ನಂತರ "
        ],
        "when": [
            "* ",
            "ಸ್ಥಿತಿಯನ್ನು "
        ]
    },
    "ko": {
        "and": [
            "* ",
            "그리고"
        ],
        "background": [
            "배경"
        ],
        "but": [
            "* ",
            "하지만",
            "단"
        ],
        "examples": [
            "예"
        ],
        "feature": [
            "기능"
        ],
        "given": [
            "* ",
            "조건",
            "먼저"
        ],
        "name": "Korean",
        "native": "한국어",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "시나리오"
        ],
        "scenarioOutline": [
            "시나리오 개요"
        ],
        "then": [
            "* ",
            "그러면"
        ],
        "when": [
            "* ",
            "만일",
            "만약"
        ]
    },
    "lt": {
        "and": [
            "* ",
            "Ir "
        ],
        "background": [
            "Kontekstas"
        ],
        "but": [
            "* ",
            "Bet "
        ],
        "examples": [
            "Pavyzdžiai",
            "Scenarijai",
            "Variantai"
        ],
        "feature": [
            "Savybė"
        ],
        "given": [
            "* ",
            "Duota "
        ],
        "name": "Lithuanian",
        "native": "lietuvių kalba",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "Pavyzdys",
            "Scenarijus"
        ],
        "scenarioOutline": [
            "Scenarijaus šablonas"
        ],
        "then": [
            "* ",
            "Tada "
        ],
        "when": [
            "* ",
            "Kai "
        ]
    },
    "lu": {
        "and": [
            "* ",
            "an ",
            "a "
        ],
        "background": [
            "Hannergrond"
        ],
        "but": [
            "* ",
            "awer ",
            "mä "
        ],
        "examples": [
            "Beispiller"
        ],
        "feature": [
            "Funktionalitéit"
        ],
        "given": [
            "* ",
            "ugeholl "
        ],
        "name": "Luxemburgish",
        "native": "Lëtzebuergesch",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "Beispill",
            "Szenario"
        ],
        "scenarioOutline": [
            "Plang vum Szenario"
        ],
        "then": [
            "* ",
            "dann "
        ],
        "when": [
            "* ",
            "wann "
        ]
    },
    "lv": {
        "and": [
            "* ",
            "Un "
        ],
        "background": [
            "Konteksts",
            "Situācija"
        ],
        "but": [
            "* ",
            "Bet "
        ],
        "examples": [
            "Piemēri",
            "Paraugs"
        ],
        "feature": [
            "Funkcionalitāte",
            "Fīča"
        ],
        "given": [
            "* ",
            "Kad "
        ],
        "name": "Latvian",
        "native": "latviešu",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "Piemērs",
            "Scenārijs"
        ],
        "scenarioOutline": [
            "Scenārijs pēc parauga"
        ],
        "then": [
            "* ",
            "Tad "
        ],
        "when": [
            "* ",
            "Ja "
        ]
    },
    "mk-Cyrl": {
        "and": [
            "* ",
            "И "
        ],
        "background": [
            "Контекст",
            "Содржина"
        ],
        "but": [
            "* ",
            "Но "
        ],
        "examples": [
            "Примери",
            "Сценарија"
        ],
        "feature": [
            "Функционалност",
            "Бизнис потреба",
            "Можност"
        ],
        "given": [
            "* ",
            "Дадено ",
            "Дадена "
        ],
        "name": "Macedonian",
        "native": "Македонски",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "Пример",
            "Сценарио",
            "На пример"
        ],
        "scenarioOutline": [
            "Преглед на сценарија",
            "Скица",
            "Концепт"
        ],
        "then": [
            "* ",
            "Тогаш "
        ],
        "when": [
            "* ",
            "Кога "
        ]
    },
    "mk-Latn": {
        "and": [
            "* ",
            "I "
        ],
        "background": [
            "Kontekst",
            "Sodrzhina"
        ],
        "but": [
            "* ",
            "No "
        ],
        "examples": [
            "Primeri",
            "Scenaria"
        ],
        "feature": [
            "Funkcionalnost",
            "Biznis potreba",
            "Mozhnost"
        ],
        "given": [
            "* ",
            "Dadeno ",
            "Dadena "
        ],
        "name": "Macedonian (Latin)",
        "native": "Makedonski (Latinica)",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "Scenario",
            "Na primer"
        ],
        "scenarioOutline": [
            "Pregled na scenarija",
            "Skica",
            "Koncept"
        ],
        "then": [
            "* ",
            "Togash "
        ],
        "when": [
            "* ",
            "Koga "
        ]
    },
    "mn": {
        "and": [
            "* ",
            "Мөн ",
            "Тэгээд "
        ],
        "background": [
            "Агуулга"
        ],
        "but": [
            "* ",
            "Гэхдээ ",
            "Харин "
        ],
        "examples": [
            "Тухайлбал"
        ],
        "feature": [
            "Функц",
            "Функционал"
        ],
        "given": [
            "* ",
            "Өгөгдсөн нь ",
            "Анх "
        ],
        "name": "Mongolian",
        "native": "монгол",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "Сценар"
        ],
        "scenarioOutline": [
            "Сценарын төлөвлөгөө"
        ],
        "then": [
            "* ",
            "Тэгэхэд ",
            "Үүний дараа "
        ],
        "when": [
            "* ",
            "Хэрэв "
        ]
    },
    "ne": {
        "and": [
            "* ",
            "र ",
            "अनि "
        ],
        "background": [
            "पृष्ठभूमी"
        ],
        "but": [
            "* ",
            "तर "
        ],
        "examples": [
            "उदाहरण",
            "उदाहरणहरु"
        ],
        "feature": [
            "सुविधा",
            "विशेषता"
        ],
        "given": [
            "* ",
            "दिइएको ",
            "दिएको ",
            "यदि "
        ],
        "name": "Nepali",
        "native": "नेपाली",
        "rule": [
            "नियम"
        ],
        "scenario": [
            "परिदृश्य"
        ],
        "scenarioOutline": [
            "परिदृश्य रूपरेखा"
        ],
        "then": [
            "* ",
            "त्यसपछि ",
            "अनी "
        ],
        "when": [
            "* ",
            "जब "
        ]
    },
    "nl": {
        "and": [
            "* ",
            "En "
        ],
        "background": [
            "Achtergrond"
        ],
        "but": [
            "* ",
            "Maar "
        ],
        "examples": [
            "Voorbeelden"
        ],
        "feature": [
            "Functionaliteit"
        ],
        "given": [
            "* ",
            "Gegeven ",
            "Stel "
        ],
        "name": "Dutch",
        "native": "Nederlands",
        "rule": [
            "Regel"
        ],
        "scenario": [
            "Voorbeeld",
            "Scenario"
        ],
        "scenarioOutline": [
            "Abstract Scenario"
        ],
        "then": [
            "* ",
            "Dan "
        ],
        "when": [
            "* ",
            "Als ",
            "Wanneer "
        ]
    },
    "no": {
        "and": [
            "* ",
            "Og "
        ],
        "background": [
            "Bakgrunn"
        ],
        "but": [
            "* ",
            "Men "
        ],
        "examples": [
            "Eksempler"
        ],
        "feature": [
            "Egenskap"
        ],
        "given": [
            "* ",
            "Gitt "
        ],
        "name": "Norwegian",
        "native": "norsk",
        "rule": [
            "Regel"
        ],
        "scenario": [
            "Eksempel",
            "Scenario"
        ],
        "scenarioOutline": [
            "Scenariomal",
            "Abstrakt Scenario"
        ],
        "then": [
            "* ",
            "Så "
        ],
        "when": [
            "* ",
            "Når "
        ]
    },
    "pa": {
        "and": [
            "* ",
            "ਅਤੇ "
        ],
        "background": [
            "ਪਿਛੋਕੜ"
        ],
        "but": [
            "* ",
            "ਪਰ "
        ],
        "examples": [
            "ਉਦਾਹਰਨਾਂ"
        ],
        "feature": [
            "ਖਾਸੀਅਤ",
            "ਮੁਹਾਂਦਰਾ",
            "ਨਕਸ਼ ਨੁਹਾਰ"
        ],
        "given": [
            "* ",
            "ਜੇਕਰ ",
            "ਜਿਵੇਂ ਕਿ "
        ],
        "name": "Panjabi",
        "native": "ਪੰਜਾਬੀ",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "ਉਦਾਹਰਨ",
            "ਪਟਕਥਾ"
        ],
        "scenarioOutline": [
            "ਪਟਕਥਾ ਢਾਂਚਾ",
            "ਪਟਕਥਾ ਰੂਪ ਰੇਖਾ"
        ],
        "then": [
            "* ",
            "ਤਦ "
        ],
        "when": [
            "* ",
            "ਜਦੋਂ "
        ]
    },
    "pl": {
        "and": [
            "* ",
            "Oraz ",
            "I "
        ],
        "background": [
            "Założenia"
        ],
        "but": [
            "* ",
            "Ale "
        ],
        "examples": [
            "Przykłady"
        ],
        "feature": [
            "Właściwość",
            "Funkcja",
            "Aspekt",
            "Potrzeba biznesowa"
        ],
        "given": [
            "* ",
            "Zakładając ",
            "Mając ",
            "Zakładając, że "
        ],
        "name": "Polish",
        "native": "polski",
        "rule": [
            "Zasada",
            "Reguła"
        ],
        "scenario": [
            "Przykład",
            "Scenariusz"
        ],
        "scenarioOutline": [
            "Szablon scenariusza"
        ],
        "then": [
            "* ",
            "Wtedy "
        ],
        "when": [
            "* ",
            "Jeżeli ",
            "Jeśli ",
            "Gdy ",
            "Kiedy "
        ]
    },
    "pt": {
        "and": [
            "* ",
            "E "
        ],
        "background": [
            "Contexto",
            "Cenário de Fundo",
            "Cenario de Fundo",
            "Fundo"
        ],
        "but": [
            "* ",
            "Mas "
        ],
        "examples": [
            "Exemplos",
            "Cenários",
            "Cenarios"
        ],
        "feature": [
            "Funcionalidade",
            "Característica",
            "Caracteristica"
        ],
        "given": [
            "* ",
            "Dado ",
            "Dada ",
            "Dados ",
            "Dadas "
        ],
        "name": "Portuguese",
        "native": "português",
        "rule": [
            "Regra"
        ],
        "scenario": [
            "Exemplo",
            "Cenário",
            "Cenario"
        ],
        "scenarioOutline": [
            "Esquema do Cenário",
            "Esquema do Cenario",
            "Delineação do Cenário",
            "Delineacao do Cenario"
        ],
        "then": [
            "* ",
            "Então ",
            "Entao "
        ],
        "when": [
            "* ",
            "Quando "
        ]
    },
    "ro": {
        "and": [
            "* ",
            "Si ",
            "Și ",
            "Şi "
        ],
        "background": [
            "Context"
        ],
        "but": [
            "* ",
            "Dar "
        ],
        "examples": [
            "Exemple"
        ],
        "feature": [
            "Functionalitate",
            "Funcționalitate",
            "Funcţionalitate"
        ],
        "given": [
            "* ",
            "Date fiind ",
            "Dat fiind ",
            "Dată fiind",
            "Dati fiind ",
            "Dați fiind ",
            "Daţi fiind "
        ],
        "name": "Romanian",
        "native": "română",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "Exemplu",
            "Scenariu"
        ],
        "scenarioOutline": [
            "Structura scenariu",
            "Structură scenariu"
        ],
        "then": [
            "* ",
            "Atunci "
        ],
        "when": [
            "* ",
            "Cand ",
            "Când "
        ]
    },
    "ru": {
        "and": [
            "* ",
            "И ",
            "К тому же ",
            "Также "
        ],
        "background": [
            "Предыстория",
            "Контекст"
        ],
        "but": [
            "* ",
            "Но ",
            "А ",
            "Иначе "
        ],
        "examples": [
            "Примеры"
        ],
        "feature": [
            "Функция",
            "Функциональность",
            "Функционал",
            "Свойство",
            "Фича"
        ],
        "given": [
            "* ",
            "Допустим ",
            "Дано ",
            "Пусть "
        ],
        "name": "Russian",
        "native": "русский",
        "rule": [
            "Правило"
        ],
        "scenario": [
            "Пример",
            "Сценарий"
        ],
        "scenarioOutline": [
            "Структура сценария",
            "Шаблон сценария"
        ],
        "then": [
            "* ",
            "То ",
            "Затем ",
            "Тогда "
        ],
        "when": [
            "* ",
            "Когда ",
            "Если "
        ]
    },
    "sk": {
        "and": [
            "* ",
            "A ",
            "A tiež ",
            "A taktiež ",
            "A zároveň "
        ],
        "background": [
            "Pozadie"
        ],
        "but": [
            "* ",
            "Ale "
        ],
        "examples": [
            "Príklady"
        ],
        "feature": [
            "Požiadavka",
            "Funkcia",
            "Vlastnosť"
        ],
        "given": [
            "* ",
            "Pokiaľ ",
            "Za predpokladu "
        ],
        "name": "Slovak",
        "native": "Slovensky",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "Príklad",
            "Scenár"
        ],
        "scenarioOutline": [
            "Náčrt Scenáru",
            "Náčrt Scenára",
            "Osnova Scenára"
        ],
        "then": [
            "* ",
            "Tak ",
            "Potom "
        ],
        "when": [
            "* ",
            "Keď ",
            "Ak "
        ]
    },
    "sl": {
        "and": [
            "In ",
            "Ter "
        ],
        "background": [
            "Kontekst",
            "Osnova",
            "Ozadje"
        ],
        "but": [
            "Toda ",
            "Ampak ",
            "Vendar "
        ],
        "examples": [
            "Primeri",
            "Scenariji"
        ],
        "feature": [
            "Funkcionalnost",
            "Funkcija",
            "Možnosti",
            "Moznosti",
            "Lastnost",
            "Značilnost"
        ],
        "given": [
            "Dano ",
            "Podano ",
            "Zaradi ",
            "Privzeto "
        ],
        "name": "Slovenian",
        "native": "Slovenski",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "Primer",
            "Scenarij"
        ],
        "scenarioOutline": [
            "Struktura scenarija",
            "Skica",
            "Koncept",
            "Oris scenarija",
            "Osnutek"
        ],
        "then": [
            "Nato ",
            "Potem ",
            "Takrat "
        ],
        "when": [
            "Ko ",
            "Ce ",
            "Če ",
            "Kadar "
        ]
    },
    "sr-Cyrl": {
        "and": [
            "* ",
            "И "
        ],
        "background": [
            "Контекст",
            "Основа",
            "Позадина"
        ],
        "but": [
            "* ",
            "Али "
        ],
        "examples": [
            "Примери",
            "Сценарији"
        ],
        "feature": [
            "Функционалност",
            "Могућност",
            "Особина"
        ],
        "given": [
            "* ",
            "За дато ",
            "За дате ",
            "За дати "
        ],
        "name": "Serbian",
        "native": "Српски",
        "rule": [
            "Правило"
        ],
        "scenario": [
            "Пример",
            "Сценарио",
            "Пример"
        ],
        "scenarioOutline": [
            "Структура сценарија",
            "Скица",
            "Концепт"
        ],
        "then": [
            "* ",
            "Онда "
        ],
        "when": [
            "* ",
            "Када ",
            "Кад "
        ]
    },
    "sr-Latn": {
        "and": [
            "* ",
            "I "
        ],
        "background": [
            "Kontekst",
            "Osnova",
            "Pozadina"
        ],
        "but": [
            "* ",
            "Ali "
        ],
        "examples": [
            "Primeri",
            "Scenariji"
        ],
        "feature": [
            "Funkcionalnost",
            "Mogućnost",
            "Mogucnost",
            "Osobina"
        ],
        "given": [
            "* ",
            "Za dato ",
            "Za date ",
            "Za dati "
        ],
        "name": "Serbian (Latin)",
        "native": "Srpski (Latinica)",
        "rule": [
            "Pravilo"
        ],
        "scenario": [
            "Scenario",
            "Primer"
        ],
        "scenarioOutline": [
            "Struktura scenarija",
            "Skica",
            "Koncept"
        ],
        "then": [
            "* ",
            "Onda "
        ],
        "when": [
            "* ",
            "Kada ",
            "Kad "
        ]
    },
    "sv": {
        "and": [
            "* ",
            "Och "
        ],
        "background": [
            "Bakgrund"
        ],
        "but": [
            "* ",
            "Men "
        ],
        "examples": [
            "Exempel"
        ],
        "feature": [
            "Egenskap"
        ],
        "given": [
            "* ",
            "Givet "
        ],
        "name": "Swedish",
        "native": "Svenska",
        "rule": [
            "Regel"
        ],
        "scenario": [
            "Scenario"
        ],
        "scenarioOutline": [
            "Abstrakt Scenario",
            "Scenariomall"
        ],
        "then": [
            "* ",
            "Så "
        ],
        "when": [
            "* ",
            "När "
        ]
    },
    "ta": {
        "and": [
            "* ",
            "மேலும்  ",
            "மற்றும் "
        ],
        "background": [
            "பின்னணி"
        ],
        "but": [
            "* ",
            "ஆனால்  "
        ],
        "examples": [
            "எடுத்துக்காட்டுகள்",
            "காட்சிகள்",
            "நிலைமைகளில்"
        ],
        "feature": [
            "அம்சம்",
            "வணிக தேவை",
            "திறன்"
        ],
        "given": [
            "* ",
            "கொடுக்கப்பட்ட "
        ],
        "name": "Tamil",
        "native": "தமிழ்",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "உதாரணமாக",
            "காட்சி"
        ],
        "scenarioOutline": [
            "காட்சி சுருக்கம்",
            "காட்சி வார்ப்புரு"
        ],
        "then": [
            "* ",
            "அப்பொழுது "
        ],
        "when": [
            "* ",
            "எப்போது "
        ]
    },
    "th": {
        "and": [
            "* ",
            "และ "
        ],
        "background": [
            "แนวคิด"
        ],
        "but": [
            "* ",
            "แต่ "
        ],
        "examples": [
            "ชุดของตัวอย่าง",
            "ชุดของเหตุการณ์"
        ],
        "feature": [
            "โครงหลัก",
            "ความต้องการทางธุรกิจ",
            "ความสามารถ"
        ],
        "given": [
            "* ",
            "กำหนดให้ "
        ],
        "name": "Thai",
        "native": "ไทย",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "เหตุการณ์"
        ],
        "scenarioOutline": [
            "สรุปเหตุการณ์",
            "โครงสร้างของเหตุการณ์"
        ],
        "then": [
            "* ",
            "ดังนั้น "
        ],
        "when": [
            "* ",
            "เมื่อ "
        ]
    },
    "te": {
        "and": [
            "* ",
            "మరియు "
        ],
        "background": [
            "నేపథ్యం"
        ],
        "but": [
            "* ",
            "కాని "
        ],
        "examples": [
            "ఉదాహరణలు"
        ],
        "feature": [
            "గుణము"
        ],
        "given": [
            "* ",
            "చెప్పబడినది "
        ],
        "name": "Telugu",
        "native": "తెలుగు",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "ఉదాహరణ",
            "సన్నివేశం"
        ],
        "scenarioOutline": [
            "కథనం"
        ],
        "then": [
            "* ",
            "అప్పుడు "
        ],
        "when": [
            "* ",
            "ఈ పరిస్థితిలో "
        ]
    },
    "tlh": {
        "and": [
            "* ",
            "'ej ",
            "latlh "
        ],
        "background": [
            "mo'"
        ],
        "but": [
            "* ",
            "'ach ",
            "'a "
        ],
        "examples": [
            "ghantoH",
            "lutmey"
        ],
        "feature": [
            "Qap",
            "Qu'meH 'ut",
            "perbogh",
            "poQbogh malja'",
            "laH"
        ],
        "given": [
            "* ",
            "ghu' noblu' ",
            "DaH ghu' bejlu' "
        ],
        "name": "Klingon",
        "native": "tlhIngan",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "lut"
        ],
        "scenarioOutline": [
            "lut chovnatlh"
        ],
        "then": [
            "* ",
            "vaj "
        ],
        "when": [
            "* ",
            "qaSDI' "
        ]
    },
    "tr": {
        "and": [
            "* ",
            "Ve "
        ],
        "background": [
            "Geçmiş"
        ],
        "but": [
            "* ",
            "Fakat ",
            "Ama "
        ],
        "examples": [
            "Örnekler"
        ],
        "feature": [
            "Özellik"
        ],
        "given": [
            "* ",
            "Diyelim ki "
        ],
        "name": "Turkish",
        "native": "Türkçe",
        "rule": [
            "Kural"
        ],
        "scenario": [
            "Örnek",
            "Senaryo"
        ],
        "scenarioOutline": [
            "Senaryo taslağı"
        ],
        "then": [
            "* ",
            "O zaman "
        ],
        "when": [
            "* ",
            "Eğer ki "
        ]
    },
    "tt": {
        "and": [
            "* ",
            "Һәм ",
            "Вә "
        ],
        "background": [
            "Кереш"
        ],
        "but": [
            "* ",
            "Ләкин ",
            "Әмма "
        ],
        "examples": [
            "Үрнәкләр",
            "Мисаллар"
        ],
        "feature": [
            "Мөмкинлек",
            "Үзенчәлеклелек"
        ],
        "given": [
            "* ",
            "Әйтик "
        ],
        "name": "Tatar",
        "native": "Татарча",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "Сценарий"
        ],
        "scenarioOutline": [
            "Сценарийның төзелеше"
        ],
        "then": [
            "* ",
            "Нәтиҗәдә "
        ],
        "when": [
            "* ",
            "Әгәр "
        ]
    },
    "uk": {
        "and": [
            "* ",
            "І ",
            "А також ",
            "Та "
        ],
        "background": [
            "Передумова"
        ],
        "but": [
            "* ",
            "Але "
        ],
        "examples": [
            "Приклади"
        ],
        "feature": [
            "Функціонал"
        ],
        "given": [
            "* ",
            "Припустимо ",
            "Припустимо, що ",
            "Нехай ",
            "Дано "
        ],
        "name": "Ukrainian",
        "native": "Українська",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "Приклад",
            "Сценарій"
        ],
        "scenarioOutline": [
            "Структура сценарію"
        ],
        "then": [
            "* ",
            "То ",
            "Тоді "
        ],
        "when": [
            "* ",
            "Якщо ",
            "Коли "
        ]
    },
    "ur": {
        "and": [
            "* ",
            "اور "
        ],
        "background": [
            "پس منظر"
        ],
        "but": [
            "* ",
            "لیکن "
        ],
        "examples": [
            "مثالیں"
        ],
        "feature": [
            "صلاحیت",
            "کاروبار کی ضرورت",
            "خصوصیت"
        ],
        "given": [
            "* ",
            "اگر ",
            "بالفرض ",
            "فرض کیا "
        ],
        "name": "Urdu",
        "native": "اردو",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "منظرنامہ"
        ],
        "scenarioOutline": [
            "منظر نامے کا خاکہ"
        ],
        "then": [
            "* ",
            "پھر ",
            "تب "
        ],
        "when": [
            "* ",
            "جب "
        ]
    },
    "uz": {
        "and": [
            "* ",
            "Ва "
        ],
        "background": [
            "Тарих"
        ],
        "but": [
            "* ",
            "Лекин ",
            "Бирок ",
            "Аммо "
        ],
        "examples": [
            "Мисоллар"
        ],
        "feature": [
            "Функционал"
        ],
        "given": [
            "* ",
            "Belgilangan "
        ],
        "name": "Uzbek",
        "native": "Узбекча",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "Сценарий"
        ],
        "scenarioOutline": [
            "Сценарий структураси"
        ],
        "then": [
            "* ",
            "Унда "
        ],
        "when": [
            "* ",
            "Агар "
        ]
    },
    "vi": {
        "and": [
            "* ",
            "Và "
        ],
        "background": [
            "Bối cảnh"
        ],
        "but": [
            "* ",
            "Nhưng "
        ],
        "examples": [
            "Dữ liệu"
        ],
        "feature": [
            "Tính năng"
        ],
        "given": [
            "* ",
            "Biết ",
            "Cho "
        ],
        "name": "Vietnamese",
        "native": "Tiếng Việt",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "Tình huống",
            "Kịch bản"
        ],
        "scenarioOutline": [
            "Khung tình huống",
            "Khung kịch bản"
        ],
        "then": [
            "* ",
            "Thì "
        ],
        "when": [
            "* ",
            "Khi "
        ]
    },
    "zh-CN": {
        "and": [
            "* ",
            "而且",
            "并且",
            "同时"
        ],
        "background": [
            "背景"
        ],
        "but": [
            "* ",
            "但是"
        ],
        "examples": [
            "例子"
        ],
        "feature": [
            "功能"
        ],
        "given": [
            "* ",
            "假如",
            "假设",
            "假定"
        ],
        "name": "Chinese simplified",
        "native": "简体中文",
        "rule": [
            "Rule",
            "规则"
        ],
        "scenario": [
            "场景",
            "剧本"
        ],
        "scenarioOutline": [
            "场景大纲",
            "剧本大纲"
        ],
        "then": [
            "* ",
            "那么"
        ],
        "when": [
            "* ",
            "当"
        ]
    },
    "ml": {
        "and": [
            "* ",
            "ഒപ്പം"
        ],
        "background": [
            "പശ്ചാത്തലം"
        ],
        "but": [
            "* ",
            "പക്ഷേ"
        ],
        "examples": [
            "ഉദാഹരണങ്ങൾ"
        ],
        "feature": [
            "സവിശേഷത"
        ],
        "given": [
            "* ",
            "നൽകിയത്"
        ],
        "name": "Malayalam",
        "native": "മലയാളം",
        "rule": [
            "നിയമം"
        ],
        "scenario": [
            "രംഗം"
        ],
        "scenarioOutline": [
            "സാഹചര്യത്തിന്റെ രൂപരേഖ"
        ],
        "then": [
            "* ",
            "പിന്നെ"
        ],
        "when": [
            "എപ്പോൾ"
        ]
    },
    "zh-TW": {
        "and": [
            "* ",
            "而且",
            "並且",
            "同時"
        ],
        "background": [
            "背景"
        ],
        "but": [
            "* ",
            "但是"
        ],
        "examples": [
            "例子"
        ],
        "feature": [
            "功能"
        ],
        "given": [
            "* ",
            "假如",
            "假設",
            "假定"
        ],
        "name": "Chinese traditional",
        "native": "繁體中文",
        "rule": [
            "Rule"
        ],
        "scenario": [
            "場景",
            "劇本"
        ],
        "scenarioOutline": [
            "場景大綱",
            "劇本大綱"
        ],
        "then": [
            "* ",
            "那麼"
        ],
        "when": [
            "* ",
            "當"
        ]
    },
    "mr": {
        "and": [
            "* ",
            "आणि ",
            "तसेच "
        ],
        "background": [
            "पार्श्वभूमी"
        ],
        "but": [
            "* ",
            "पण ",
            "परंतु "
        ],
        "examples": [
            "उदाहरण"
        ],
        "feature": [
            "वैशिष्ट्य",
            "सुविधा"
        ],
        "given": [
            "* ",
            "जर",
            "दिलेल्या प्रमाणे "
        ],
        "name": "Marathi",
        "native": "मराठी",
        "rule": [
            "नियम"
        ],
        "scenario": [
            "परिदृश्य"
        ],
        "scenarioOutline": [
            "परिदृश्य रूपरेखा"
        ],
        "then": [
            "* ",
            "मग ",
            "तेव्हा "
        ],
        "when": [
            "* ",
            "जेव्हा "
        ]
    },
    "amh": {
        "and": [
            "* ",
            "እና "
        ],
        "background": [
            "ቅድመ ሁኔታ",
            "መነሻ",
            "መነሻ ሀሳብ"
        ],
        "but": [
            "* ",
            "ግን "
        ],
        "examples": [
            "ምሳሌዎች",
            "ሁናቴዎች"
        ],
        "feature": [
            "ስራ",
            "የተፈለገው ስራ",
            "የሚፈለገው ድርጊት"
        ],
        "given": [
            "* ",
            "የተሰጠ "
        ],
        "name": "Amharic",
        "native": "አማርኛ",
        "rule": [
            "ህግ"
        ],
        "scenario": [
            "ምሳሌ",
            "ሁናቴ"
        ],
        "scenarioOutline": [
            "ሁናቴ ዝርዝር",
            "ሁናቴ አብነት"
        ],
        "then": [
            "* ",
            "ከዚያ "
        ],
        "when": [
            "* ",
            "መቼ "
        ]
    }
}

},{}],13:[function(require,module,exports){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.compile = exports.GherkinInMarkdownTokenMatcher = exports.GherkinClassicTokenMatcher = exports.Errors = exports.TokenScanner = exports.AstBuilder = exports.Parser = exports.dialects = exports.makeSourceEnvelope = exports.generateMessages = void 0;
const generateMessages_1 = __importDefault(require("./generateMessages"));
exports.generateMessages = generateMessages_1.default;
const makeSourceEnvelope_1 = __importDefault(require("./makeSourceEnvelope"));
exports.makeSourceEnvelope = makeSourceEnvelope_1.default;
const Parser_1 = __importDefault(require("./Parser"));
exports.Parser = Parser_1.default;
const AstBuilder_1 = __importDefault(require("./AstBuilder"));
exports.AstBuilder = AstBuilder_1.default;
const TokenScanner_1 = __importDefault(require("./TokenScanner"));
exports.TokenScanner = TokenScanner_1.default;
const Errors = __importStar(require("./Errors"));
exports.Errors = Errors;
const compile_1 = __importDefault(require("./pickles/compile"));
exports.compile = compile_1.default;
const gherkin_languages_json_1 = __importDefault(require("./gherkin-languages.json"));
const GherkinClassicTokenMatcher_1 = __importDefault(require("./GherkinClassicTokenMatcher"));
exports.GherkinClassicTokenMatcher = GherkinClassicTokenMatcher_1.default;
const GherkinInMarkdownTokenMatcher_1 = __importDefault(require("./GherkinInMarkdownTokenMatcher"));
exports.GherkinInMarkdownTokenMatcher = GherkinInMarkdownTokenMatcher_1.default;
const dialects = gherkin_languages_json_1.default;
exports.dialects = dialects;

},{"./AstBuilder":1,"./Errors":3,"./GherkinClassicTokenMatcher":4,"./GherkinInMarkdownTokenMatcher":5,"./Parser":7,"./TokenScanner":9,"./generateMessages":11,"./gherkin-languages.json":12,"./makeSourceEnvelope":14,"./pickles/compile":15}],14:[function(require,module,exports){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const messages = __importStar(require("@cucumber/messages"));
function makeSourceEnvelope(data, uri) {
    let mediaType;
    if (uri.endsWith('.feature')) {
        mediaType = messages.SourceMediaType.TEXT_X_CUCUMBER_GHERKIN_PLAIN;
    }
    else if (uri.endsWith('.md')) {
        mediaType = messages.SourceMediaType.TEXT_X_CUCUMBER_GHERKIN_MARKDOWN;
    }
    if (!mediaType)
        throw new Error(`The uri (${uri}) must end with .feature or .md`);
    return {
        source: {
            data,
            uri,
            mediaType,
        },
    };
}
exports.default = makeSourceEnvelope;
window.makeSourceEnvelope = makeSourceEnvelope;

},{"@cucumber/messages":19}],15:[function(require,module,exports){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const messages = __importStar(require("@cucumber/messages"));
const pickleStepTypeFromKeyword = {
    [messages.StepKeywordType.UNKNOWN]: messages.PickleStepType.UNKNOWN,
    [messages.StepKeywordType.CONTEXT]: messages.PickleStepType.CONTEXT,
    [messages.StepKeywordType.ACTION]: messages.PickleStepType.ACTION,
    [messages.StepKeywordType.OUTCOME]: messages.PickleStepType.OUTCOME,
    [messages.StepKeywordType.CONJUNCTION]: null
};
function compile(gherkinDocument, uri, newId) {
    const pickles = [];
    if (gherkinDocument.feature == null) {
        return pickles;
    }
    const feature = gherkinDocument.feature;
    const language = feature.language;
    const featureTags = feature.tags;
    let featureBackgroundSteps = [];
    feature.children.forEach((stepsContainer) => {
        if (stepsContainer.background) {
            featureBackgroundSteps = [].concat(stepsContainer.background.steps);
        }
        else if (stepsContainer.rule) {
            compileRule(featureTags, featureBackgroundSteps, stepsContainer.rule, language, pickles, uri, newId);
        }
        else if (stepsContainer.scenario.examples.length === 0) {
            compileScenario(featureTags, featureBackgroundSteps, stepsContainer.scenario, language, pickles, uri, newId);
        }
        else {
            compileScenarioOutline(featureTags, featureBackgroundSteps, stepsContainer.scenario, language, pickles, uri, newId);
        }
    });
    return pickles;
}
exports.default = compile;
window.compile = compile;

function compileRule(featureTags, featureBackgroundSteps, rule, language, pickles, uri, newId) {
    let ruleBackgroundSteps = [].concat(featureBackgroundSteps);
    const tags = [].concat(featureTags).concat(rule.tags);
    rule.children.forEach((stepsContainer) => {
        if (stepsContainer.background) {
            ruleBackgroundSteps = ruleBackgroundSteps.concat(stepsContainer.background.steps);
        }
        else if (stepsContainer.scenario.examples.length === 0) {
            compileScenario(tags, ruleBackgroundSteps, stepsContainer.scenario, language, pickles, uri, newId);
        }
        else {
            compileScenarioOutline(tags, ruleBackgroundSteps, stepsContainer.scenario, language, pickles, uri, newId);
        }
    });
}
function compileScenario(inheritedTags, backgroundSteps, scenario, language, pickles, uri, newId) {
    let lastKeywordType = messages.StepKeywordType.UNKNOWN;
    const steps = [];
    if (scenario.steps.length !== 0) {
        backgroundSteps.forEach((step) => {
            lastKeywordType = (step.keywordType === messages.StepKeywordType.CONJUNCTION) ?
                lastKeywordType : step.keywordType;
            steps.push(pickleStep(step, [], null, newId, lastKeywordType));
        });
    }
    const tags = [].concat(inheritedTags).concat(scenario.tags);
    scenario.steps.forEach((step) => {
        lastKeywordType = (step.keywordType === messages.StepKeywordType.CONJUNCTION) ?
            lastKeywordType : step.keywordType;
        steps.push(pickleStep(step, [], null, newId, lastKeywordType));
    });
    const pickle = {
        id: newId(),
        uri,
        astNodeIds: [scenario.id],
        tags: pickleTags(tags),
        name: scenario.name,
        language,
        steps,
    };
    pickles.push(pickle);
}
function compileScenarioOutline(inheritedTags, backgroundSteps, scenario, language, pickles, uri, newId) {
    scenario.examples
        .filter((e) => e.tableHeader)
        .forEach((examples) => {
        const variableCells = examples.tableHeader.cells;
        examples.tableBody.forEach((valuesRow) => {
            let lastKeywordType = messages.StepKeywordType.UNKNOWN;
            const steps = [];
            if (scenario.steps.length !== 0) {
                backgroundSteps.forEach((step) => {
                    lastKeywordType = (step.keywordType === messages.StepKeywordType.CONJUNCTION) ?
                        lastKeywordType : step.keywordType;
                    steps.push(pickleStep(step, [], null, newId, lastKeywordType));
                });
            }
            scenario.steps.forEach((scenarioOutlineStep) => {
                lastKeywordType = (scenarioOutlineStep.keywordType === messages.StepKeywordType.CONJUNCTION) ?
                    lastKeywordType : scenarioOutlineStep.keywordType;
                const step = pickleStep(scenarioOutlineStep, variableCells, valuesRow, newId, lastKeywordType);
                steps.push(step);
            });
            const id = newId();
            const tags = pickleTags([].concat(inheritedTags).concat(scenario.tags).concat(examples.tags));
            pickles.push({
                id,
                uri,
                astNodeIds: [scenario.id, valuesRow.id],
                name: interpolate(scenario.name, variableCells, valuesRow.cells),
                language,
                steps,
                tags,
            });
        });
    });
}
function createPickleArguments(step, variableCells, valueCells) {
    if (step.dataTable) {
        const argument = step.dataTable;
        const table = {
            rows: argument.rows.map((row) => {
                return {
                    cells: row.cells.map((cell) => {
                        return {
                            value: interpolate(cell.value, variableCells, valueCells),
                        };
                    }),
                };
            }),
        };
        return { dataTable: table };
    }
    else if (step.docString) {
        const argument = step.docString;
        const docString = {
            content: interpolate(argument.content, variableCells, valueCells),
        };
        if (argument.mediaType) {
            docString.mediaType = interpolate(argument.mediaType, variableCells, valueCells);
        }
        return { docString };
    }
}
function interpolate(name, variableCells, valueCells) {
    variableCells.forEach((variableCell, n) => {
        const valueCell = valueCells[n];
        const valuePattern = '<' + variableCell.value + '>';
        const escapedPattern = valuePattern.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regexp = new RegExp(escapedPattern, 'g');
        // JS Specific - dollar sign needs to be escaped with another dollar sign
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#Specifying_a_string_as_a_parameter
        const replacement = valueCell.value.replace(new RegExp('\\$', 'g'), '$$$$');
        name = name.replace(regexp, replacement);
    });
    return name;
}
function pickleStep(step, variableCells, valuesRow, newId, keywordType) {
    const astNodeIds = [step.id];
    if (valuesRow) {
        astNodeIds.push(valuesRow.id);
    }
    const valueCells = valuesRow ? valuesRow.cells : [];
    return {
        id: newId(),
        text: interpolate(step.text, variableCells, valueCells),
        type: pickleStepTypeFromKeyword[keywordType],
        argument: createPickleArguments(step, variableCells, valueCells),
        astNodeIds: astNodeIds,
    };
}
function pickleTags(tags) {
    return tags.map(pickleTag);
}
function pickleTag(tag) {
    return {
        name: tag.name,
        astNodeId: tag.id,
    };
}

},{"@cucumber/messages":19}],16:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.incrementing = exports.uuid = void 0;
var uuid_1 = require("uuid");
function uuid() {
    return function () { return (0, uuid_1.v4)(); };
}
exports.uuid = uuid;
function incrementing() {
    var next = 0;
    return function () { return (next++).toString(); };
}
exports.incrementing = incrementing;

},{"uuid":58}],17:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addDurations = exports.durationToMilliseconds = exports.timestampToMillisecondsSinceEpoch = exports.millisecondsToDuration = exports.millisecondsSinceEpochToTimestamp = void 0;
var MILLISECONDS_PER_SECOND = 1e3;
var NANOSECONDS_PER_MILLISECOND = 1e6;
var NANOSECONDS_PER_SECOND = 1e9;
function millisecondsSinceEpochToTimestamp(millisecondsSinceEpoch) {
    return toSecondsAndNanos(millisecondsSinceEpoch);
}
exports.millisecondsSinceEpochToTimestamp = millisecondsSinceEpochToTimestamp;
function millisecondsToDuration(durationInMilliseconds) {
    return toSecondsAndNanos(durationInMilliseconds);
}
exports.millisecondsToDuration = millisecondsToDuration;
function timestampToMillisecondsSinceEpoch(timestamp) {
    var seconds = timestamp.seconds, nanos = timestamp.nanos;
    return toMillis(seconds, nanos);
}
exports.timestampToMillisecondsSinceEpoch = timestampToMillisecondsSinceEpoch;
function durationToMilliseconds(duration) {
    var seconds = duration.seconds, nanos = duration.nanos;
    return toMillis(seconds, nanos);
}
exports.durationToMilliseconds = durationToMilliseconds;
function addDurations(durationA, durationB) {
    var seconds = +durationA.seconds + +durationB.seconds;
    var nanos = durationA.nanos + durationB.nanos;
    if (nanos >= NANOSECONDS_PER_SECOND) {
        seconds += 1;
        nanos -= NANOSECONDS_PER_SECOND;
    }
    return { seconds: seconds, nanos: nanos };
}
exports.addDurations = addDurations;
function toSecondsAndNanos(milliseconds) {
    var seconds = Math.floor(milliseconds / MILLISECONDS_PER_SECOND);
    var nanos = Math.floor((milliseconds % MILLISECONDS_PER_SECOND) * NANOSECONDS_PER_MILLISECOND);
    return { seconds: seconds, nanos: nanos };
}
function toMillis(seconds, nanos) {
    var secondMillis = +seconds * MILLISECONDS_PER_SECOND;
    var nanoMillis = nanos / NANOSECONDS_PER_MILLISECOND;
    return secondMillis + nanoMillis;
}

},{}],18:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorstTestStepResult = void 0;
var messages_js_1 = require("./messages.js");
var TimeConversion_js_1 = require("./TimeConversion.js");
/**
 * Gets the worst result
 * @param testStepResults
 */
function getWorstTestStepResult(testStepResults) {
    return (testStepResults.slice().sort(function (r1, r2) { return ordinal(r2.status) - ordinal(r1.status); })[0] || {
        status: messages_js_1.TestStepResultStatus.UNKNOWN,
        duration: (0, TimeConversion_js_1.millisecondsToDuration)(0),
    });
}
exports.getWorstTestStepResult = getWorstTestStepResult;
function ordinal(status) {
    return [
        messages_js_1.TestStepResultStatus.UNKNOWN,
        messages_js_1.TestStepResultStatus.PASSED,
        messages_js_1.TestStepResultStatus.SKIPPED,
        messages_js_1.TestStepResultStatus.PENDING,
        messages_js_1.TestStepResultStatus.UNDEFINED,
        messages_js_1.TestStepResultStatus.AMBIGUOUS,
        messages_js_1.TestStepResultStatus.FAILED,
    ].indexOf(status);
}

},{"./TimeConversion.js":17,"./messages.js":20}],19:[function(require,module,exports){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorstTestStepResult = exports.parseEnvelope = exports.version = exports.IdGenerator = exports.TimeConversion = void 0;
var TimeConversion = __importStar(require("./TimeConversion.js"));
exports.TimeConversion = TimeConversion;
var IdGenerator = __importStar(require("./IdGenerator.js"));
exports.IdGenerator = IdGenerator;
var parseEnvelope_js_1 = require("./parseEnvelope.js");
Object.defineProperty(exports, "parseEnvelope", { enumerable: true, get: function () { return parseEnvelope_js_1.parseEnvelope; } });
var getWorstTestStepResult_js_1 = require("./getWorstTestStepResult.js");
Object.defineProperty(exports, "getWorstTestStepResult", { enumerable: true, get: function () { return getWorstTestStepResult_js_1.getWorstTestStepResult; } });
var version_js_1 = require("./version.js");
Object.defineProperty(exports, "version", { enumerable: true, get: function () { return version_js_1.version; } });
__exportStar(require("./messages.js"), exports);

},{"./IdGenerator.js":16,"./TimeConversion.js":17,"./getWorstTestStepResult.js":18,"./messages.js":20,"./parseEnvelope.js":21,"./version.js":22}],20:[function(require,module,exports){
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestRunStarted = exports.TestRunFinished = exports.TestCaseStarted = exports.TestCaseFinished = exports.TestStep = exports.StepMatchArgumentsList = exports.StepMatchArgument = exports.Group = exports.TestCase = exports.StepDefinitionPattern = exports.StepDefinition = exports.JavaStackTraceElement = exports.JavaMethod = exports.SourceReference = exports.Source = exports.PickleTag = exports.PickleTableRow = exports.PickleTableCell = exports.PickleTable = exports.PickleStepArgument = exports.PickleStep = exports.PickleDocString = exports.Pickle = exports.ParseError = exports.ParameterType = exports.Product = exports.Git = exports.Ci = exports.Meta = exports.Location = exports.Hook = exports.Tag = exports.TableRow = exports.TableCell = exports.Step = exports.Scenario = exports.RuleChild = exports.Rule = exports.FeatureChild = exports.Feature = exports.Examples = exports.DocString = exports.DataTable = exports.Comment = exports.Background = exports.GherkinDocument = exports.Exception = exports.Envelope = exports.Duration = exports.Attachment = void 0;
exports.TestStepResultStatus = exports.StepKeywordType = exports.StepDefinitionPatternType = exports.SourceMediaType = exports.PickleStepType = exports.AttachmentContentEncoding = exports.UndefinedParameterType = exports.Timestamp = exports.TestStepStarted = exports.TestStepResult = exports.TestStepFinished = void 0;
var class_transformer_1 = require("class-transformer");
require("reflect-metadata");
var Attachment = /** @class */ (function () {
    function Attachment() {
        this.body = '';
        this.contentEncoding = AttachmentContentEncoding.IDENTITY;
        this.mediaType = '';
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return Source; })
    ], Attachment.prototype, "source", void 0);
    return Attachment;
}());
exports.Attachment = Attachment;
var Duration = /** @class */ (function () {
    function Duration() {
        this.seconds = 0;
        this.nanos = 0;
    }
    return Duration;
}());
exports.Duration = Duration;
var Envelope = /** @class */ (function () {
    function Envelope() {
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return Attachment; })
    ], Envelope.prototype, "attachment", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return GherkinDocument; })
    ], Envelope.prototype, "gherkinDocument", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return Hook; })
    ], Envelope.prototype, "hook", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return Meta; })
    ], Envelope.prototype, "meta", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return ParameterType; })
    ], Envelope.prototype, "parameterType", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return ParseError; })
    ], Envelope.prototype, "parseError", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return Pickle; })
    ], Envelope.prototype, "pickle", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return Source; })
    ], Envelope.prototype, "source", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return StepDefinition; })
    ], Envelope.prototype, "stepDefinition", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return TestCase; })
    ], Envelope.prototype, "testCase", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return TestCaseFinished; })
    ], Envelope.prototype, "testCaseFinished", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return TestCaseStarted; })
    ], Envelope.prototype, "testCaseStarted", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return TestRunFinished; })
    ], Envelope.prototype, "testRunFinished", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return TestRunStarted; })
    ], Envelope.prototype, "testRunStarted", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return TestStepFinished; })
    ], Envelope.prototype, "testStepFinished", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return TestStepStarted; })
    ], Envelope.prototype, "testStepStarted", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return UndefinedParameterType; })
    ], Envelope.prototype, "undefinedParameterType", void 0);
    return Envelope;
}());
exports.Envelope = Envelope;
var Exception = /** @class */ (function () {
    function Exception() {
        this.type = '';
    }
    return Exception;
}());
exports.Exception = Exception;
var GherkinDocument = /** @class */ (function () {
    function GherkinDocument() {
        this.comments = [];
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return Feature; })
    ], GherkinDocument.prototype, "feature", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return Comment; })
    ], GherkinDocument.prototype, "comments", void 0);
    return GherkinDocument;
}());
exports.GherkinDocument = GherkinDocument;
var Background = /** @class */ (function () {
    function Background() {
        this.location = new Location();
        this.keyword = '';
        this.name = '';
        this.description = '';
        this.steps = [];
        this.id = '';
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return Location; })
    ], Background.prototype, "location", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return Step; })
    ], Background.prototype, "steps", void 0);
    return Background;
}());
exports.Background = Background;
var Comment = /** @class */ (function () {
    function Comment() {
        this.location = new Location();
        this.text = '';
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return Location; })
    ], Comment.prototype, "location", void 0);
    return Comment;
}());
exports.Comment = Comment;
var DataTable = /** @class */ (function () {
    function DataTable() {
        this.location = new Location();
        this.rows = [];
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return Location; })
    ], DataTable.prototype, "location", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return TableRow; })
    ], DataTable.prototype, "rows", void 0);
    return DataTable;
}());
exports.DataTable = DataTable;
var DocString = /** @class */ (function () {
    function DocString() {
        this.location = new Location();
        this.content = '';
        this.delimiter = '';
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return Location; })
    ], DocString.prototype, "location", void 0);
    return DocString;
}());
exports.DocString = DocString;
var Examples = /** @class */ (function () {
    function Examples() {
        this.location = new Location();
        this.tags = [];
        this.keyword = '';
        this.name = '';
        this.description = '';
        this.tableBody = [];
        this.id = '';
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return Location; })
    ], Examples.prototype, "location", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return Tag; })
    ], Examples.prototype, "tags", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return TableRow; })
    ], Examples.prototype, "tableHeader", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return TableRow; })
    ], Examples.prototype, "tableBody", void 0);
    return Examples;
}());
exports.Examples = Examples;
var Feature = /** @class */ (function () {
    function Feature() {
        this.location = new Location();
        this.tags = [];
        this.language = '';
        this.keyword = '';
        this.name = '';
        this.description = '';
        this.children = [];
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return Location; })
    ], Feature.prototype, "location", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return Tag; })
    ], Feature.prototype, "tags", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return FeatureChild; })
    ], Feature.prototype, "children", void 0);
    return Feature;
}());
exports.Feature = Feature;
var FeatureChild = /** @class */ (function () {
    function FeatureChild() {
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return Rule; })
    ], FeatureChild.prototype, "rule", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return Background; })
    ], FeatureChild.prototype, "background", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return Scenario; })
    ], FeatureChild.prototype, "scenario", void 0);
    return FeatureChild;
}());
exports.FeatureChild = FeatureChild;
var Rule = /** @class */ (function () {
    function Rule() {
        this.location = new Location();
        this.tags = [];
        this.keyword = '';
        this.name = '';
        this.description = '';
        this.children = [];
        this.id = '';
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return Location; })
    ], Rule.prototype, "location", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return Tag; })
    ], Rule.prototype, "tags", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return RuleChild; })
    ], Rule.prototype, "children", void 0);
    return Rule;
}());
exports.Rule = Rule;
var RuleChild = /** @class */ (function () {
    function RuleChild() {
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return Background; })
    ], RuleChild.prototype, "background", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return Scenario; })
    ], RuleChild.prototype, "scenario", void 0);
    return RuleChild;
}());
exports.RuleChild = RuleChild;
var Scenario = /** @class */ (function () {
    function Scenario() {
        this.location = new Location();
        this.tags = [];
        this.keyword = '';
        this.name = '';
        this.description = '';
        this.steps = [];
        this.examples = [];
        this.id = '';
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return Location; })
    ], Scenario.prototype, "location", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return Tag; })
    ], Scenario.prototype, "tags", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return Step; })
    ], Scenario.prototype, "steps", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return Examples; })
    ], Scenario.prototype, "examples", void 0);
    return Scenario;
}());
exports.Scenario = Scenario;
var Step = /** @class */ (function () {
    function Step() {
        this.location = new Location();
        this.keyword = '';
        this.text = '';
        this.id = '';
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return Location; })
    ], Step.prototype, "location", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return DocString; })
    ], Step.prototype, "docString", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return DataTable; })
    ], Step.prototype, "dataTable", void 0);
    return Step;
}());
exports.Step = Step;
var TableCell = /** @class */ (function () {
    function TableCell() {
        this.location = new Location();
        this.value = '';
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return Location; })
    ], TableCell.prototype, "location", void 0);
    return TableCell;
}());
exports.TableCell = TableCell;
var TableRow = /** @class */ (function () {
    function TableRow() {
        this.location = new Location();
        this.cells = [];
        this.id = '';
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return Location; })
    ], TableRow.prototype, "location", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return TableCell; })
    ], TableRow.prototype, "cells", void 0);
    return TableRow;
}());
exports.TableRow = TableRow;
var Tag = /** @class */ (function () {
    function Tag() {
        this.location = new Location();
        this.name = '';
        this.id = '';
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return Location; })
    ], Tag.prototype, "location", void 0);
    return Tag;
}());
exports.Tag = Tag;
var Hook = /** @class */ (function () {
    function Hook() {
        this.id = '';
        this.sourceReference = new SourceReference();
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return SourceReference; })
    ], Hook.prototype, "sourceReference", void 0);
    return Hook;
}());
exports.Hook = Hook;
var Location = /** @class */ (function () {
    function Location() {
        this.line = 0;
    }
    return Location;
}());
exports.Location = Location;
var Meta = /** @class */ (function () {
    function Meta() {
        this.protocolVersion = '';
        this.implementation = new Product();
        this.runtime = new Product();
        this.os = new Product();
        this.cpu = new Product();
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return Product; })
    ], Meta.prototype, "implementation", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return Product; })
    ], Meta.prototype, "runtime", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return Product; })
    ], Meta.prototype, "os", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return Product; })
    ], Meta.prototype, "cpu", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return Ci; })
    ], Meta.prototype, "ci", void 0);
    return Meta;
}());
exports.Meta = Meta;
var Ci = /** @class */ (function () {
    function Ci() {
        this.name = '';
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return Git; })
    ], Ci.prototype, "git", void 0);
    return Ci;
}());
exports.Ci = Ci;
var Git = /** @class */ (function () {
    function Git() {
        this.remote = '';
        this.revision = '';
    }
    return Git;
}());
exports.Git = Git;
var Product = /** @class */ (function () {
    function Product() {
        this.name = '';
    }
    return Product;
}());
exports.Product = Product;
var ParameterType = /** @class */ (function () {
    function ParameterType() {
        this.name = '';
        this.regularExpressions = [];
        this.preferForRegularExpressionMatch = false;
        this.useForSnippets = false;
        this.id = '';
    }
    return ParameterType;
}());
exports.ParameterType = ParameterType;
var ParseError = /** @class */ (function () {
    function ParseError() {
        this.source = new SourceReference();
        this.message = '';
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return SourceReference; })
    ], ParseError.prototype, "source", void 0);
    return ParseError;
}());
exports.ParseError = ParseError;
var Pickle = /** @class */ (function () {
    function Pickle() {
        this.id = '';
        this.uri = '';
        this.name = '';
        this.language = '';
        this.steps = [];
        this.tags = [];
        this.astNodeIds = [];
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return PickleStep; })
    ], Pickle.prototype, "steps", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return PickleTag; })
    ], Pickle.prototype, "tags", void 0);
    return Pickle;
}());
exports.Pickle = Pickle;
var PickleDocString = /** @class */ (function () {
    function PickleDocString() {
        this.content = '';
    }
    return PickleDocString;
}());
exports.PickleDocString = PickleDocString;
var PickleStep = /** @class */ (function () {
    function PickleStep() {
        this.astNodeIds = [];
        this.id = '';
        this.text = '';
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return PickleStepArgument; })
    ], PickleStep.prototype, "argument", void 0);
    return PickleStep;
}());
exports.PickleStep = PickleStep;
var PickleStepArgument = /** @class */ (function () {
    function PickleStepArgument() {
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return PickleDocString; })
    ], PickleStepArgument.prototype, "docString", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return PickleTable; })
    ], PickleStepArgument.prototype, "dataTable", void 0);
    return PickleStepArgument;
}());
exports.PickleStepArgument = PickleStepArgument;
var PickleTable = /** @class */ (function () {
    function PickleTable() {
        this.rows = [];
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return PickleTableRow; })
    ], PickleTable.prototype, "rows", void 0);
    return PickleTable;
}());
exports.PickleTable = PickleTable;
var PickleTableCell = /** @class */ (function () {
    function PickleTableCell() {
        this.value = '';
    }
    return PickleTableCell;
}());
exports.PickleTableCell = PickleTableCell;
var PickleTableRow = /** @class */ (function () {
    function PickleTableRow() {
        this.cells = [];
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return PickleTableCell; })
    ], PickleTableRow.prototype, "cells", void 0);
    return PickleTableRow;
}());
exports.PickleTableRow = PickleTableRow;
var PickleTag = /** @class */ (function () {
    function PickleTag() {
        this.name = '';
        this.astNodeId = '';
    }
    return PickleTag;
}());
exports.PickleTag = PickleTag;
var Source = /** @class */ (function () {
    function Source() {
        this.uri = '';
        this.data = '';
        this.mediaType = SourceMediaType.TEXT_X_CUCUMBER_GHERKIN_PLAIN;
    }
    return Source;
}());
exports.Source = Source;
var SourceReference = /** @class */ (function () {
    function SourceReference() {
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return JavaMethod; })
    ], SourceReference.prototype, "javaMethod", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return JavaStackTraceElement; })
    ], SourceReference.prototype, "javaStackTraceElement", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return Location; })
    ], SourceReference.prototype, "location", void 0);
    return SourceReference;
}());
exports.SourceReference = SourceReference;
var JavaMethod = /** @class */ (function () {
    function JavaMethod() {
        this.className = '';
        this.methodName = '';
        this.methodParameterTypes = [];
    }
    return JavaMethod;
}());
exports.JavaMethod = JavaMethod;
var JavaStackTraceElement = /** @class */ (function () {
    function JavaStackTraceElement() {
        this.className = '';
        this.fileName = '';
        this.methodName = '';
    }
    return JavaStackTraceElement;
}());
exports.JavaStackTraceElement = JavaStackTraceElement;
var StepDefinition = /** @class */ (function () {
    function StepDefinition() {
        this.id = '';
        this.pattern = new StepDefinitionPattern();
        this.sourceReference = new SourceReference();
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return StepDefinitionPattern; })
    ], StepDefinition.prototype, "pattern", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return SourceReference; })
    ], StepDefinition.prototype, "sourceReference", void 0);
    return StepDefinition;
}());
exports.StepDefinition = StepDefinition;
var StepDefinitionPattern = /** @class */ (function () {
    function StepDefinitionPattern() {
        this.source = '';
        this.type = StepDefinitionPatternType.CUCUMBER_EXPRESSION;
    }
    return StepDefinitionPattern;
}());
exports.StepDefinitionPattern = StepDefinitionPattern;
var TestCase = /** @class */ (function () {
    function TestCase() {
        this.id = '';
        this.pickleId = '';
        this.testSteps = [];
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return TestStep; })
    ], TestCase.prototype, "testSteps", void 0);
    return TestCase;
}());
exports.TestCase = TestCase;
var Group = /** @class */ (function () {
    function Group() {
        this.children = [];
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return Group; })
    ], Group.prototype, "children", void 0);
    return Group;
}());
exports.Group = Group;
var StepMatchArgument = /** @class */ (function () {
    function StepMatchArgument() {
        this.group = new Group();
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return Group; })
    ], StepMatchArgument.prototype, "group", void 0);
    return StepMatchArgument;
}());
exports.StepMatchArgument = StepMatchArgument;
var StepMatchArgumentsList = /** @class */ (function () {
    function StepMatchArgumentsList() {
        this.stepMatchArguments = [];
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return StepMatchArgument; })
    ], StepMatchArgumentsList.prototype, "stepMatchArguments", void 0);
    return StepMatchArgumentsList;
}());
exports.StepMatchArgumentsList = StepMatchArgumentsList;
var TestStep = /** @class */ (function () {
    function TestStep() {
        this.id = '';
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return StepMatchArgumentsList; })
    ], TestStep.prototype, "stepMatchArgumentsLists", void 0);
    return TestStep;
}());
exports.TestStep = TestStep;
var TestCaseFinished = /** @class */ (function () {
    function TestCaseFinished() {
        this.testCaseStartedId = '';
        this.timestamp = new Timestamp();
        this.willBeRetried = false;
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return Timestamp; })
    ], TestCaseFinished.prototype, "timestamp", void 0);
    return TestCaseFinished;
}());
exports.TestCaseFinished = TestCaseFinished;
var TestCaseStarted = /** @class */ (function () {
    function TestCaseStarted() {
        this.attempt = 0;
        this.id = '';
        this.testCaseId = '';
        this.timestamp = new Timestamp();
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return Timestamp; })
    ], TestCaseStarted.prototype, "timestamp", void 0);
    return TestCaseStarted;
}());
exports.TestCaseStarted = TestCaseStarted;
var TestRunFinished = /** @class */ (function () {
    function TestRunFinished() {
        this.success = false;
        this.timestamp = new Timestamp();
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return Timestamp; })
    ], TestRunFinished.prototype, "timestamp", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return Exception; })
    ], TestRunFinished.prototype, "exception", void 0);
    return TestRunFinished;
}());
exports.TestRunFinished = TestRunFinished;
var TestRunStarted = /** @class */ (function () {
    function TestRunStarted() {
        this.timestamp = new Timestamp();
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return Timestamp; })
    ], TestRunStarted.prototype, "timestamp", void 0);
    return TestRunStarted;
}());
exports.TestRunStarted = TestRunStarted;
var TestStepFinished = /** @class */ (function () {
    function TestStepFinished() {
        this.testCaseStartedId = '';
        this.testStepId = '';
        this.testStepResult = new TestStepResult();
        this.timestamp = new Timestamp();
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return TestStepResult; })
    ], TestStepFinished.prototype, "testStepResult", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return Timestamp; })
    ], TestStepFinished.prototype, "timestamp", void 0);
    return TestStepFinished;
}());
exports.TestStepFinished = TestStepFinished;
var TestStepResult = /** @class */ (function () {
    function TestStepResult() {
        this.duration = new Duration();
        this.status = TestStepResultStatus.UNKNOWN;
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return Duration; })
    ], TestStepResult.prototype, "duration", void 0);
    __decorate([
        (0, class_transformer_1.Type)(function () { return Exception; })
    ], TestStepResult.prototype, "exception", void 0);
    return TestStepResult;
}());
exports.TestStepResult = TestStepResult;
var TestStepStarted = /** @class */ (function () {
    function TestStepStarted() {
        this.testCaseStartedId = '';
        this.testStepId = '';
        this.timestamp = new Timestamp();
    }
    __decorate([
        (0, class_transformer_1.Type)(function () { return Timestamp; })
    ], TestStepStarted.prototype, "timestamp", void 0);
    return TestStepStarted;
}());
exports.TestStepStarted = TestStepStarted;
var Timestamp = /** @class */ (function () {
    function Timestamp() {
        this.seconds = 0;
        this.nanos = 0;
    }
    return Timestamp;
}());
exports.Timestamp = Timestamp;
var UndefinedParameterType = /** @class */ (function () {
    function UndefinedParameterType() {
        this.expression = '';
        this.name = '';
    }
    return UndefinedParameterType;
}());
exports.UndefinedParameterType = UndefinedParameterType;
var AttachmentContentEncoding;
(function (AttachmentContentEncoding) {
    AttachmentContentEncoding["IDENTITY"] = "IDENTITY";
    AttachmentContentEncoding["BASE64"] = "BASE64";
})(AttachmentContentEncoding = exports.AttachmentContentEncoding || (exports.AttachmentContentEncoding = {}));
var PickleStepType;
(function (PickleStepType) {
    PickleStepType["UNKNOWN"] = "Unknown";
    PickleStepType["CONTEXT"] = "Context";
    PickleStepType["ACTION"] = "Action";
    PickleStepType["OUTCOME"] = "Outcome";
})(PickleStepType = exports.PickleStepType || (exports.PickleStepType = {}));
var SourceMediaType;
(function (SourceMediaType) {
    SourceMediaType["TEXT_X_CUCUMBER_GHERKIN_PLAIN"] = "text/x.cucumber.gherkin+plain";
    SourceMediaType["TEXT_X_CUCUMBER_GHERKIN_MARKDOWN"] = "text/x.cucumber.gherkin+markdown";
})(SourceMediaType = exports.SourceMediaType || (exports.SourceMediaType = {}));
var StepDefinitionPatternType;
(function (StepDefinitionPatternType) {
    StepDefinitionPatternType["CUCUMBER_EXPRESSION"] = "CUCUMBER_EXPRESSION";
    StepDefinitionPatternType["REGULAR_EXPRESSION"] = "REGULAR_EXPRESSION";
})(StepDefinitionPatternType = exports.StepDefinitionPatternType || (exports.StepDefinitionPatternType = {}));
var StepKeywordType;
(function (StepKeywordType) {
    StepKeywordType["UNKNOWN"] = "Unknown";
    StepKeywordType["CONTEXT"] = "Context";
    StepKeywordType["ACTION"] = "Action";
    StepKeywordType["OUTCOME"] = "Outcome";
    StepKeywordType["CONJUNCTION"] = "Conjunction";
})(StepKeywordType = exports.StepKeywordType || (exports.StepKeywordType = {}));
var TestStepResultStatus;
(function (TestStepResultStatus) {
    TestStepResultStatus["UNKNOWN"] = "UNKNOWN";
    TestStepResultStatus["PASSED"] = "PASSED";
    TestStepResultStatus["SKIPPED"] = "SKIPPED";
    TestStepResultStatus["PENDING"] = "PENDING";
    TestStepResultStatus["UNDEFINED"] = "UNDEFINED";
    TestStepResultStatus["AMBIGUOUS"] = "AMBIGUOUS";
    TestStepResultStatus["FAILED"] = "FAILED";
})(TestStepResultStatus = exports.TestStepResultStatus || (exports.TestStepResultStatus = {}));

},{"class-transformer":37,"reflect-metadata":57}],21:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseEnvelope = void 0;
var messages_js_1 = require("./messages.js");
var class_transformer_1 = require("class-transformer");
/**
 * Parses JSON into an Envelope object. The difference from JSON.parse
 * is that the resulting objects will have default values (defined in the JSON Schema)
 * for properties that are absent from the JSON.
 */
function parseEnvelope(json) {
    var plain = JSON.parse(json);
    return (0, class_transformer_1.plainToClass)(messages_js_1.Envelope, plain);
}
exports.parseEnvelope = parseEnvelope;

},{"./messages.js":20,"class-transformer":37}],22:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = void 0;
// This file is automatically generated using npm scripts
exports.version = '21.0.1';

},{}],23:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClassTransformer = void 0;
const TransformOperationExecutor_1 = require("./TransformOperationExecutor");
const enums_1 = require("./enums");
const default_options_constant_1 = require("./constants/default-options.constant");
class ClassTransformer {
    instanceToPlain(object, options) {
        const executor = new TransformOperationExecutor_1.TransformOperationExecutor(enums_1.TransformationType.CLASS_TO_PLAIN, {
            ...default_options_constant_1.defaultOptions,
            ...options,
        });
        return executor.transform(undefined, object, undefined, undefined, undefined, undefined);
    }
    classToPlainFromExist(object, plainObject, options) {
        const executor = new TransformOperationExecutor_1.TransformOperationExecutor(enums_1.TransformationType.CLASS_TO_PLAIN, {
            ...default_options_constant_1.defaultOptions,
            ...options,
        });
        return executor.transform(plainObject, object, undefined, undefined, undefined, undefined);
    }
    plainToInstance(cls, plain, options) {
        const executor = new TransformOperationExecutor_1.TransformOperationExecutor(enums_1.TransformationType.PLAIN_TO_CLASS, {
            ...default_options_constant_1.defaultOptions,
            ...options,
        });
        return executor.transform(undefined, plain, cls, undefined, undefined, undefined);
    }
    plainToClassFromExist(clsObject, plain, options) {
        const executor = new TransformOperationExecutor_1.TransformOperationExecutor(enums_1.TransformationType.PLAIN_TO_CLASS, {
            ...default_options_constant_1.defaultOptions,
            ...options,
        });
        return executor.transform(clsObject, plain, undefined, undefined, undefined, undefined);
    }
    instanceToInstance(object, options) {
        const executor = new TransformOperationExecutor_1.TransformOperationExecutor(enums_1.TransformationType.CLASS_TO_CLASS, {
            ...default_options_constant_1.defaultOptions,
            ...options,
        });
        return executor.transform(undefined, object, undefined, undefined, undefined, undefined);
    }
    classToClassFromExist(object, fromObject, options) {
        const executor = new TransformOperationExecutor_1.TransformOperationExecutor(enums_1.TransformationType.CLASS_TO_CLASS, {
            ...default_options_constant_1.defaultOptions,
            ...options,
        });
        return executor.transform(fromObject, object, undefined, undefined, undefined, undefined);
    }
    serialize(object, options) {
        return JSON.stringify(this.instanceToPlain(object, options));
    }
    /**
     * Deserializes given JSON string to a object of the given class.
     */
    deserialize(cls, json, options) {
        const jsonObject = JSON.parse(json);
        return this.plainToInstance(cls, jsonObject, options);
    }
    /**
     * Deserializes given JSON string to an array of objects of the given class.
     */
    deserializeArray(cls, json, options) {
        const jsonObject = JSON.parse(json);
        return this.plainToInstance(cls, jsonObject, options);
    }
}
exports.ClassTransformer = ClassTransformer;

},{"./TransformOperationExecutor":25,"./constants/default-options.constant":26,"./enums":35}],24:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetadataStorage = void 0;
const enums_1 = require("./enums");
/**
 * Storage all library metadata.
 */
class MetadataStorage {
    constructor() {
        // -------------------------------------------------------------------------
        // Properties
        // -------------------------------------------------------------------------
        this._typeMetadatas = new Map();
        this._transformMetadatas = new Map();
        this._exposeMetadatas = new Map();
        this._excludeMetadatas = new Map();
        this._ancestorsMap = new Map();
    }
    // -------------------------------------------------------------------------
    // Adder Methods
    // -------------------------------------------------------------------------
    addTypeMetadata(metadata) {
        if (!this._typeMetadatas.has(metadata.target)) {
            this._typeMetadatas.set(metadata.target, new Map());
        }
        this._typeMetadatas.get(metadata.target).set(metadata.propertyName, metadata);
    }
    addTransformMetadata(metadata) {
        if (!this._transformMetadatas.has(metadata.target)) {
            this._transformMetadatas.set(metadata.target, new Map());
        }
        if (!this._transformMetadatas.get(metadata.target).has(metadata.propertyName)) {
            this._transformMetadatas.get(metadata.target).set(metadata.propertyName, []);
        }
        this._transformMetadatas.get(metadata.target).get(metadata.propertyName).push(metadata);
    }
    addExposeMetadata(metadata) {
        if (!this._exposeMetadatas.has(metadata.target)) {
            this._exposeMetadatas.set(metadata.target, new Map());
        }
        this._exposeMetadatas.get(metadata.target).set(metadata.propertyName, metadata);
    }
    addExcludeMetadata(metadata) {
        if (!this._excludeMetadatas.has(metadata.target)) {
            this._excludeMetadatas.set(metadata.target, new Map());
        }
        this._excludeMetadatas.get(metadata.target).set(metadata.propertyName, metadata);
    }
    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------
    findTransformMetadatas(target, propertyName, transformationType) {
        return this.findMetadatas(this._transformMetadatas, target, propertyName).filter(metadata => {
            if (!metadata.options)
                return true;
            if (metadata.options.toClassOnly === true && metadata.options.toPlainOnly === true)
                return true;
            if (metadata.options.toClassOnly === true) {
                return (transformationType === enums_1.TransformationType.CLASS_TO_CLASS ||
                    transformationType === enums_1.TransformationType.PLAIN_TO_CLASS);
            }
            if (metadata.options.toPlainOnly === true) {
                return transformationType === enums_1.TransformationType.CLASS_TO_PLAIN;
            }
            return true;
        });
    }
    findExcludeMetadata(target, propertyName) {
        return this.findMetadata(this._excludeMetadatas, target, propertyName);
    }
    findExposeMetadata(target, propertyName) {
        return this.findMetadata(this._exposeMetadatas, target, propertyName);
    }
    findExposeMetadataByCustomName(target, name) {
        return this.getExposedMetadatas(target).find(metadata => {
            return metadata.options && metadata.options.name === name;
        });
    }
    findTypeMetadata(target, propertyName) {
        return this.findMetadata(this._typeMetadatas, target, propertyName);
    }
    getStrategy(target) {
        const excludeMap = this._excludeMetadatas.get(target);
        const exclude = excludeMap && excludeMap.get(undefined);
        const exposeMap = this._exposeMetadatas.get(target);
        const expose = exposeMap && exposeMap.get(undefined);
        if ((exclude && expose) || (!exclude && !expose))
            return 'none';
        return exclude ? 'excludeAll' : 'exposeAll';
    }
    getExposedMetadatas(target) {
        return this.getMetadata(this._exposeMetadatas, target);
    }
    getExcludedMetadatas(target) {
        return this.getMetadata(this._excludeMetadatas, target);
    }
    getExposedProperties(target, transformationType) {
        return this.getExposedMetadatas(target)
            .filter(metadata => {
            if (!metadata.options)
                return true;
            if (metadata.options.toClassOnly === true && metadata.options.toPlainOnly === true)
                return true;
            if (metadata.options.toClassOnly === true) {
                return (transformationType === enums_1.TransformationType.CLASS_TO_CLASS ||
                    transformationType === enums_1.TransformationType.PLAIN_TO_CLASS);
            }
            if (metadata.options.toPlainOnly === true) {
                return transformationType === enums_1.TransformationType.CLASS_TO_PLAIN;
            }
            return true;
        })
            .map(metadata => metadata.propertyName);
    }
    getExcludedProperties(target, transformationType) {
        return this.getExcludedMetadatas(target)
            .filter(metadata => {
            if (!metadata.options)
                return true;
            if (metadata.options.toClassOnly === true && metadata.options.toPlainOnly === true)
                return true;
            if (metadata.options.toClassOnly === true) {
                return (transformationType === enums_1.TransformationType.CLASS_TO_CLASS ||
                    transformationType === enums_1.TransformationType.PLAIN_TO_CLASS);
            }
            if (metadata.options.toPlainOnly === true) {
                return transformationType === enums_1.TransformationType.CLASS_TO_PLAIN;
            }
            return true;
        })
            .map(metadata => metadata.propertyName);
    }
    clear() {
        this._typeMetadatas.clear();
        this._exposeMetadatas.clear();
        this._excludeMetadatas.clear();
        this._ancestorsMap.clear();
    }
    // -------------------------------------------------------------------------
    // Private Methods
    // -------------------------------------------------------------------------
    getMetadata(metadatas, target) {
        const metadataFromTargetMap = metadatas.get(target);
        let metadataFromTarget;
        if (metadataFromTargetMap) {
            metadataFromTarget = Array.from(metadataFromTargetMap.values()).filter(meta => meta.propertyName !== undefined);
        }
        const metadataFromAncestors = [];
        for (const ancestor of this.getAncestors(target)) {
            const ancestorMetadataMap = metadatas.get(ancestor);
            if (ancestorMetadataMap) {
                const metadataFromAncestor = Array.from(ancestorMetadataMap.values()).filter(meta => meta.propertyName !== undefined);
                metadataFromAncestors.push(...metadataFromAncestor);
            }
        }
        return metadataFromAncestors.concat(metadataFromTarget || []);
    }
    findMetadata(metadatas, target, propertyName) {
        const metadataFromTargetMap = metadatas.get(target);
        if (metadataFromTargetMap) {
            const metadataFromTarget = metadataFromTargetMap.get(propertyName);
            if (metadataFromTarget) {
                return metadataFromTarget;
            }
        }
        for (const ancestor of this.getAncestors(target)) {
            const ancestorMetadataMap = metadatas.get(ancestor);
            if (ancestorMetadataMap) {
                const ancestorResult = ancestorMetadataMap.get(propertyName);
                if (ancestorResult) {
                    return ancestorResult;
                }
            }
        }
        return undefined;
    }
    findMetadatas(metadatas, target, propertyName) {
        const metadataFromTargetMap = metadatas.get(target);
        let metadataFromTarget;
        if (metadataFromTargetMap) {
            metadataFromTarget = metadataFromTargetMap.get(propertyName);
        }
        const metadataFromAncestorsTarget = [];
        for (const ancestor of this.getAncestors(target)) {
            const ancestorMetadataMap = metadatas.get(ancestor);
            if (ancestorMetadataMap) {
                if (ancestorMetadataMap.has(propertyName)) {
                    metadataFromAncestorsTarget.push(...ancestorMetadataMap.get(propertyName));
                }
            }
        }
        return metadataFromAncestorsTarget
            .slice()
            .reverse()
            .concat((metadataFromTarget || []).slice().reverse());
    }
    getAncestors(target) {
        if (!target)
            return [];
        if (!this._ancestorsMap.has(target)) {
            const ancestors = [];
            for (let baseClass = Object.getPrototypeOf(target.prototype.constructor); typeof baseClass.prototype !== 'undefined'; baseClass = Object.getPrototypeOf(baseClass.prototype.constructor)) {
                ancestors.push(baseClass);
            }
            this._ancestorsMap.set(target, ancestors);
        }
        return this._ancestorsMap.get(target);
    }
}
exports.MetadataStorage = MetadataStorage;

},{"./enums":35}],25:[function(require,module,exports){
(function (Buffer){(function (){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransformOperationExecutor = void 0;
const storage_1 = require("./storage");
const enums_1 = require("./enums");
const utils_1 = require("./utils");
function instantiateArrayType(arrayType) {
    const array = new arrayType();
    if (!(array instanceof Set) && !('push' in array)) {
        return [];
    }
    return array;
}
class TransformOperationExecutor {
    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(transformationType, options) {
        this.transformationType = transformationType;
        this.options = options;
        // -------------------------------------------------------------------------
        // Private Properties
        // -------------------------------------------------------------------------
        this.recursionStack = new Set();
    }
    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------
    transform(source, value, targetType, arrayType, isMap, level = 0) {
        if (Array.isArray(value) || value instanceof Set) {
            const newValue = arrayType && this.transformationType === enums_1.TransformationType.PLAIN_TO_CLASS
                ? instantiateArrayType(arrayType)
                : [];
            value.forEach((subValue, index) => {
                const subSource = source ? source[index] : undefined;
                if (!this.options.enableCircularCheck || !this.isCircular(subValue)) {
                    let realTargetType;
                    if (typeof targetType !== 'function' &&
                        targetType &&
                        targetType.options &&
                        targetType.options.discriminator &&
                        targetType.options.discriminator.property &&
                        targetType.options.discriminator.subTypes) {
                        if (this.transformationType === enums_1.TransformationType.PLAIN_TO_CLASS) {
                            realTargetType = targetType.options.discriminator.subTypes.find(subType => subType.name === subValue[targetType.options.discriminator.property]);
                            const options = { newObject: newValue, object: subValue, property: undefined };
                            const newType = targetType.typeFunction(options);
                            realTargetType === undefined ? (realTargetType = newType) : (realTargetType = realTargetType.value);
                            if (!targetType.options.keepDiscriminatorProperty)
                                delete subValue[targetType.options.discriminator.property];
                        }
                        if (this.transformationType === enums_1.TransformationType.CLASS_TO_CLASS) {
                            realTargetType = subValue.constructor;
                        }
                        if (this.transformationType === enums_1.TransformationType.CLASS_TO_PLAIN) {
                            subValue[targetType.options.discriminator.property] = targetType.options.discriminator.subTypes.find(subType => subType.value === subValue.constructor).name;
                        }
                    }
                    else {
                        realTargetType = targetType;
                    }
                    const value = this.transform(subSource, subValue, realTargetType, undefined, subValue instanceof Map, level + 1);
                    if (newValue instanceof Set) {
                        newValue.add(value);
                    }
                    else {
                        newValue.push(value);
                    }
                }
                else if (this.transformationType === enums_1.TransformationType.CLASS_TO_CLASS) {
                    if (newValue instanceof Set) {
                        newValue.add(subValue);
                    }
                    else {
                        newValue.push(subValue);
                    }
                }
            });
            return newValue;
        }
        else if (targetType === String && !isMap) {
            if (value === null || value === undefined)
                return value;
            return String(value);
        }
        else if (targetType === Number && !isMap) {
            if (value === null || value === undefined)
                return value;
            return Number(value);
        }
        else if (targetType === Boolean && !isMap) {
            if (value === null || value === undefined)
                return value;
            return Boolean(value);
        }
        else if ((targetType === Date || value instanceof Date) && !isMap) {
            if (value instanceof Date) {
                return new Date(value.valueOf());
            }
            if (value === null || value === undefined)
                return value;
            return new Date(value);
        }
        else if (!!(0, utils_1.getGlobal)().Buffer && (targetType === Buffer || value instanceof Buffer) && !isMap) {
            if (value === null || value === undefined)
                return value;
            return Buffer.from(value);
        }
        else if ((0, utils_1.isPromise)(value) && !isMap) {
            return new Promise((resolve, reject) => {
                value.then((data) => resolve(this.transform(undefined, data, targetType, undefined, undefined, level + 1)), reject);
            });
        }
        else if (!isMap && value !== null && typeof value === 'object' && typeof value.then === 'function') {
            // Note: We should not enter this, as promise has been handled above
            // This option simply returns the Promise preventing a JS error from happening and should be an inaccessible path.
            return value; // skip promise transformation
        }
        else if (typeof value === 'object' && value !== null) {
            // try to guess the type
            if (!targetType && value.constructor !== Object /* && TransformationType === TransformationType.CLASS_TO_PLAIN*/)
                if (!Array.isArray(value) && value.constructor === Array) {
                    // Somebody attempts to convert special Array like object to Array, eg:
                    // const evilObject = { '100000000': '100000000', __proto__: [] };
                    // This could be used to cause Denial-of-service attack so we don't allow it.
                    // See prevent-array-bomb.spec.ts for more details.
                }
                else {
                    // We are good we can use the built-in constructor
                    targetType = value.constructor;
                }
            if (!targetType && source)
                targetType = source.constructor;
            if (this.options.enableCircularCheck) {
                // add transformed type to prevent circular references
                this.recursionStack.add(value);
            }
            const keys = this.getKeys(targetType, value, isMap);
            let newValue = source ? source : {};
            if (!source &&
                (this.transformationType === enums_1.TransformationType.PLAIN_TO_CLASS ||
                    this.transformationType === enums_1.TransformationType.CLASS_TO_CLASS)) {
                if (isMap) {
                    newValue = new Map();
                }
                else if (targetType) {
                    newValue = new targetType();
                }
                else {
                    newValue = {};
                }
            }
            // traverse over keys
            for (const key of keys) {
                if (key === '__proto__' || key === 'constructor') {
                    continue;
                }
                const valueKey = key;
                let newValueKey = key, propertyName = key;
                if (!this.options.ignoreDecorators && targetType) {
                    if (this.transformationType === enums_1.TransformationType.PLAIN_TO_CLASS) {
                        const exposeMetadata = storage_1.defaultMetadataStorage.findExposeMetadataByCustomName(targetType, key);
                        if (exposeMetadata) {
                            propertyName = exposeMetadata.propertyName;
                            newValueKey = exposeMetadata.propertyName;
                        }
                    }
                    else if (this.transformationType === enums_1.TransformationType.CLASS_TO_PLAIN ||
                        this.transformationType === enums_1.TransformationType.CLASS_TO_CLASS) {
                        const exposeMetadata = storage_1.defaultMetadataStorage.findExposeMetadata(targetType, key);
                        if (exposeMetadata && exposeMetadata.options && exposeMetadata.options.name) {
                            newValueKey = exposeMetadata.options.name;
                        }
                    }
                }
                // get a subvalue
                let subValue = undefined;
                if (this.transformationType === enums_1.TransformationType.PLAIN_TO_CLASS) {
                    /**
                     * This section is added for the following report:
                     * https://github.com/typestack/class-transformer/issues/596
                     *
                     * We should not call functions or constructors when transforming to class.
                     */
                    subValue = value[valueKey];
                }
                else {
                    if (value instanceof Map) {
                        subValue = value.get(valueKey);
                    }
                    else if (value[valueKey] instanceof Function) {
                        subValue = value[valueKey]();
                    }
                    else {
                        subValue = value[valueKey];
                    }
                }
                // determine a type
                let type = undefined, isSubValueMap = subValue instanceof Map;
                if (targetType && isMap) {
                    type = targetType;
                }
                else if (targetType) {
                    const metadata = storage_1.defaultMetadataStorage.findTypeMetadata(targetType, propertyName);
                    if (metadata) {
                        const options = { newObject: newValue, object: value, property: propertyName };
                        const newType = metadata.typeFunction ? metadata.typeFunction(options) : metadata.reflectedType;
                        if (metadata.options &&
                            metadata.options.discriminator &&
                            metadata.options.discriminator.property &&
                            metadata.options.discriminator.subTypes) {
                            if (!(value[valueKey] instanceof Array)) {
                                if (this.transformationType === enums_1.TransformationType.PLAIN_TO_CLASS) {
                                    type = metadata.options.discriminator.subTypes.find(subType => {
                                        if (subValue && subValue instanceof Object && metadata.options.discriminator.property in subValue) {
                                            return subType.name === subValue[metadata.options.discriminator.property];
                                        }
                                    });
                                    type === undefined ? (type = newType) : (type = type.value);
                                    if (!metadata.options.keepDiscriminatorProperty) {
                                        if (subValue && subValue instanceof Object && metadata.options.discriminator.property in subValue) {
                                            delete subValue[metadata.options.discriminator.property];
                                        }
                                    }
                                }
                                if (this.transformationType === enums_1.TransformationType.CLASS_TO_CLASS) {
                                    type = subValue.constructor;
                                }
                                if (this.transformationType === enums_1.TransformationType.CLASS_TO_PLAIN) {
                                    if (subValue) {
                                        subValue[metadata.options.discriminator.property] = metadata.options.discriminator.subTypes.find(subType => subType.value === subValue.constructor).name;
                                    }
                                }
                            }
                            else {
                                type = metadata;
                            }
                        }
                        else {
                            type = newType;
                        }
                        isSubValueMap = isSubValueMap || metadata.reflectedType === Map;
                    }
                    else if (this.options.targetMaps) {
                        // try to find a type in target maps
                        this.options.targetMaps
                            .filter(map => map.target === targetType && !!map.properties[propertyName])
                            .forEach(map => (type = map.properties[propertyName]));
                    }
                    else if (this.options.enableImplicitConversion &&
                        this.transformationType === enums_1.TransformationType.PLAIN_TO_CLASS) {
                        // if we have no registererd type via the @Type() decorator then we check if we have any
                        // type declarations in reflect-metadata (type declaration is emited only if some decorator is added to the property.)
                        const reflectedType = Reflect.getMetadata('design:type', targetType.prototype, propertyName);
                        if (reflectedType) {
                            type = reflectedType;
                        }
                    }
                }
                // if value is an array try to get its custom array type
                const arrayType = Array.isArray(value[valueKey])
                    ? this.getReflectedType(targetType, propertyName)
                    : undefined;
                // const subValueKey = TransformationType === TransformationType.PLAIN_TO_CLASS && newKeyName ? newKeyName : key;
                const subSource = source ? source[valueKey] : undefined;
                // if its deserialization then type if required
                // if we uncomment this types like string[] will not work
                // if (this.transformationType === TransformationType.PLAIN_TO_CLASS && !type && subValue instanceof Object && !(subValue instanceof Date))
                //     throw new Error(`Cannot determine type for ${(targetType as any).name }.${propertyName}, did you forget to specify a @Type?`);
                // if newValue is a source object that has method that match newKeyName then skip it
                if (newValue.constructor.prototype) {
                    const descriptor = Object.getOwnPropertyDescriptor(newValue.constructor.prototype, newValueKey);
                    if ((this.transformationType === enums_1.TransformationType.PLAIN_TO_CLASS ||
                        this.transformationType === enums_1.TransformationType.CLASS_TO_CLASS) &&
                        // eslint-disable-next-line @typescript-eslint/unbound-method
                        ((descriptor && !descriptor.set) || newValue[newValueKey] instanceof Function))
                        //  || TransformationType === TransformationType.CLASS_TO_CLASS
                        continue;
                }
                if (!this.options.enableCircularCheck || !this.isCircular(subValue)) {
                    const transformKey = this.transformationType === enums_1.TransformationType.PLAIN_TO_CLASS ? newValueKey : key;
                    let finalValue;
                    if (this.transformationType === enums_1.TransformationType.CLASS_TO_PLAIN) {
                        // Get original value
                        finalValue = value[transformKey];
                        // Apply custom transformation
                        finalValue = this.applyCustomTransformations(finalValue, targetType, transformKey, value, this.transformationType);
                        // If nothing change, it means no custom transformation was applied, so use the subValue.
                        finalValue = value[transformKey] === finalValue ? subValue : finalValue;
                        // Apply the default transformation
                        finalValue = this.transform(subSource, finalValue, type, arrayType, isSubValueMap, level + 1);
                    }
                    else {
                        if (subValue === undefined && this.options.exposeDefaultValues) {
                            // Set default value if nothing provided
                            finalValue = newValue[newValueKey];
                        }
                        else {
                            finalValue = this.transform(subSource, subValue, type, arrayType, isSubValueMap, level + 1);
                            finalValue = this.applyCustomTransformations(finalValue, targetType, transformKey, value, this.transformationType);
                        }
                    }
                    if (finalValue !== undefined || this.options.exposeUnsetFields) {
                        if (newValue instanceof Map) {
                            newValue.set(newValueKey, finalValue);
                        }
                        else {
                            newValue[newValueKey] = finalValue;
                        }
                    }
                }
                else if (this.transformationType === enums_1.TransformationType.CLASS_TO_CLASS) {
                    let finalValue = subValue;
                    finalValue = this.applyCustomTransformations(finalValue, targetType, key, value, this.transformationType);
                    if (finalValue !== undefined || this.options.exposeUnsetFields) {
                        if (newValue instanceof Map) {
                            newValue.set(newValueKey, finalValue);
                        }
                        else {
                            newValue[newValueKey] = finalValue;
                        }
                    }
                }
            }
            if (this.options.enableCircularCheck) {
                this.recursionStack.delete(value);
            }
            return newValue;
        }
        else {
            return value;
        }
    }
    applyCustomTransformations(value, target, key, obj, transformationType) {
        let metadatas = storage_1.defaultMetadataStorage.findTransformMetadatas(target, key, this.transformationType);
        // apply versioning options
        if (this.options.version !== undefined) {
            metadatas = metadatas.filter(metadata => {
                if (!metadata.options)
                    return true;
                return this.checkVersion(metadata.options.since, metadata.options.until);
            });
        }
        // apply grouping options
        if (this.options.groups && this.options.groups.length) {
            metadatas = metadatas.filter(metadata => {
                if (!metadata.options)
                    return true;
                return this.checkGroups(metadata.options.groups);
            });
        }
        else {
            metadatas = metadatas.filter(metadata => {
                return !metadata.options || !metadata.options.groups || !metadata.options.groups.length;
            });
        }
        metadatas.forEach(metadata => {
            value = metadata.transformFn({ value, key, obj, type: transformationType, options: this.options });
        });
        return value;
    }
    // preventing circular references
    isCircular(object) {
        return this.recursionStack.has(object);
    }
    getReflectedType(target, propertyName) {
        if (!target)
            return undefined;
        const meta = storage_1.defaultMetadataStorage.findTypeMetadata(target, propertyName);
        return meta ? meta.reflectedType : undefined;
    }
    getKeys(target, object, isMap) {
        // determine exclusion strategy
        let strategy = storage_1.defaultMetadataStorage.getStrategy(target);
        if (strategy === 'none')
            strategy = this.options.strategy || 'exposeAll'; // exposeAll is default strategy
        // get all keys that need to expose
        let keys = [];
        if (strategy === 'exposeAll' || isMap) {
            if (object instanceof Map) {
                keys = Array.from(object.keys());
            }
            else {
                keys = Object.keys(object);
            }
        }
        if (isMap) {
            // expose & exclude do not apply for map keys only to fields
            return keys;
        }
        /**
         * If decorators are ignored but we don't want the extraneous values, then we use the
         * metadata to decide which property is needed, but doesn't apply the decorator effect.
         */
        if (this.options.ignoreDecorators && this.options.excludeExtraneousValues && target) {
            const exposedProperties = storage_1.defaultMetadataStorage.getExposedProperties(target, this.transformationType);
            const excludedProperties = storage_1.defaultMetadataStorage.getExcludedProperties(target, this.transformationType);
            keys = [...exposedProperties, ...excludedProperties];
        }
        if (!this.options.ignoreDecorators && target) {
            // add all exposed to list of keys
            let exposedProperties = storage_1.defaultMetadataStorage.getExposedProperties(target, this.transformationType);
            if (this.transformationType === enums_1.TransformationType.PLAIN_TO_CLASS) {
                exposedProperties = exposedProperties.map(key => {
                    const exposeMetadata = storage_1.defaultMetadataStorage.findExposeMetadata(target, key);
                    if (exposeMetadata && exposeMetadata.options && exposeMetadata.options.name) {
                        return exposeMetadata.options.name;
                    }
                    return key;
                });
            }
            if (this.options.excludeExtraneousValues) {
                keys = exposedProperties;
            }
            else {
                keys = keys.concat(exposedProperties);
            }
            // exclude excluded properties
            const excludedProperties = storage_1.defaultMetadataStorage.getExcludedProperties(target, this.transformationType);
            if (excludedProperties.length > 0) {
                keys = keys.filter(key => {
                    return !excludedProperties.includes(key);
                });
            }
            // apply versioning options
            if (this.options.version !== undefined) {
                keys = keys.filter(key => {
                    const exposeMetadata = storage_1.defaultMetadataStorage.findExposeMetadata(target, key);
                    if (!exposeMetadata || !exposeMetadata.options)
                        return true;
                    return this.checkVersion(exposeMetadata.options.since, exposeMetadata.options.until);
                });
            }
            // apply grouping options
            if (this.options.groups && this.options.groups.length) {
                keys = keys.filter(key => {
                    const exposeMetadata = storage_1.defaultMetadataStorage.findExposeMetadata(target, key);
                    if (!exposeMetadata || !exposeMetadata.options)
                        return true;
                    return this.checkGroups(exposeMetadata.options.groups);
                });
            }
            else {
                keys = keys.filter(key => {
                    const exposeMetadata = storage_1.defaultMetadataStorage.findExposeMetadata(target, key);
                    return (!exposeMetadata ||
                        !exposeMetadata.options ||
                        !exposeMetadata.options.groups ||
                        !exposeMetadata.options.groups.length);
                });
            }
        }
        // exclude prefixed properties
        if (this.options.excludePrefixes && this.options.excludePrefixes.length) {
            keys = keys.filter(key => this.options.excludePrefixes.every(prefix => {
                return key.substr(0, prefix.length) !== prefix;
            }));
        }
        // make sure we have unique keys
        keys = keys.filter((key, index, self) => {
            return self.indexOf(key) === index;
        });
        return keys;
    }
    checkVersion(since, until) {
        let decision = true;
        if (decision && since)
            decision = this.options.version >= since;
        if (decision && until)
            decision = this.options.version < until;
        return decision;
    }
    checkGroups(groups) {
        if (!groups)
            return true;
        return this.options.groups.some(optionGroup => groups.includes(optionGroup));
    }
}
exports.TransformOperationExecutor = TransformOperationExecutor;

}).call(this)}).call(this,require("buffer").Buffer)
},{"./enums":35,"./storage":53,"./utils":55,"buffer":75}],26:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultOptions = void 0;
/**
 * These are the default options used by any transformation operation.
 */
exports.defaultOptions = {
    enableCircularCheck: false,
    enableImplicitConversion: false,
    excludeExtraneousValues: false,
    excludePrefixes: undefined,
    exposeDefaultValues: false,
    exposeUnsetFields: true,
    groups: undefined,
    ignoreDecorators: false,
    strategy: undefined,
    targetMaps: undefined,
    version: undefined,
};
window.defaultOptions = exports.defaultOptions;

},{}],27:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Exclude = void 0;
const storage_1 = require("../storage");
/**
 * Marks the given class or property as excluded. By default the property is excluded in both
 * constructorToPlain and plainToConstructor transformations. It can be limited to only one direction
 * via using the `toPlainOnly` or `toClassOnly` option.
 *
 * Can be applied to class definitions and properties.
 */
function Exclude(options = {}) {
    /**
     * NOTE: The `propertyName` property must be marked as optional because
     * this decorator used both as a class and a property decorator and the
     * Typescript compiler will freak out if we make it mandatory as a class
     * decorator only receives one parameter.
     */
    return function (object, propertyName) {
        storage_1.defaultMetadataStorage.addExcludeMetadata({
            target: object instanceof Function ? object : object.constructor,
            propertyName: propertyName,
            options,
        });
    };
}
exports.Exclude = Exclude;

},{"../storage":53}],28:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Expose = void 0;
const storage_1 = require("../storage");
/**
 * Marks the given class or property as included. By default the property is included in both
 * constructorToPlain and plainToConstructor transformations. It can be limited to only one direction
 * via using the `toPlainOnly` or `toClassOnly` option.
 *
 * Can be applied to class definitions and properties.
 */
function Expose(options = {}) {
    /**
     * NOTE: The `propertyName` property must be marked as optional because
     * this decorator used both as a class and a property decorator and the
     * Typescript compiler will freak out if we make it mandatory as a class
     * decorator only receives one parameter.
     */
    return function (object, propertyName) {
        storage_1.defaultMetadataStorage.addExposeMetadata({
            target: object instanceof Function ? object : object.constructor,
            propertyName: propertyName,
            options,
        });
    };
}
exports.Expose = Expose;

},{"../storage":53}],29:[function(require,module,exports){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./exclude.decorator"), exports);
__exportStar(require("./expose.decorator"), exports);
__exportStar(require("./transform-instance-to-instance.decorator"), exports);
__exportStar(require("./transform-instance-to-plain.decorator"), exports);
__exportStar(require("./transform-plain-to-instance.decorator"), exports);
__exportStar(require("./transform.decorator"), exports);
__exportStar(require("./type.decorator"), exports);

},{"./exclude.decorator":27,"./expose.decorator":28,"./transform-instance-to-instance.decorator":30,"./transform-instance-to-plain.decorator":31,"./transform-plain-to-instance.decorator":32,"./transform.decorator":33,"./type.decorator":34}],30:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransformInstanceToInstance = void 0;
const ClassTransformer_1 = require("../ClassTransformer");
/**
 * Return the class instance only with the exposed properties.
 *
 * Can be applied to functions and getters/setters only.
 */
function TransformInstanceToInstance(params) {
    return function (target, propertyKey, descriptor) {
        const classTransformer = new ClassTransformer_1.ClassTransformer();
        const originalMethod = descriptor.value;
        descriptor.value = function (...args) {
            const result = originalMethod.apply(this, args);
            const isPromise = !!result && (typeof result === 'object' || typeof result === 'function') && typeof result.then === 'function';
            return isPromise
                ? result.then((data) => classTransformer.instanceToInstance(data, params))
                : classTransformer.instanceToInstance(result, params);
        };
    };
}
exports.TransformInstanceToInstance = TransformInstanceToInstance;

},{"../ClassTransformer":23}],31:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransformInstanceToPlain = void 0;
const ClassTransformer_1 = require("../ClassTransformer");
/**
 * Transform the object from class to plain object and return only with the exposed properties.
 *
 * Can be applied to functions and getters/setters only.
 */
function TransformInstanceToPlain(params) {
    return function (target, propertyKey, descriptor) {
        const classTransformer = new ClassTransformer_1.ClassTransformer();
        const originalMethod = descriptor.value;
        descriptor.value = function (...args) {
            const result = originalMethod.apply(this, args);
            const isPromise = !!result && (typeof result === 'object' || typeof result === 'function') && typeof result.then === 'function';
            return isPromise
                ? result.then((data) => classTransformer.instanceToPlain(data, params))
                : classTransformer.instanceToPlain(result, params);
        };
    };
}
exports.TransformInstanceToPlain = TransformInstanceToPlain;

},{"../ClassTransformer":23}],32:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransformPlainToInstance = void 0;
const ClassTransformer_1 = require("../ClassTransformer");
/**
 * Return the class instance only with the exposed properties.
 *
 * Can be applied to functions and getters/setters only.
 */
function TransformPlainToInstance(classType, params) {
    return function (target, propertyKey, descriptor) {
        const classTransformer = new ClassTransformer_1.ClassTransformer();
        const originalMethod = descriptor.value;
        descriptor.value = function (...args) {
            const result = originalMethod.apply(this, args);
            const isPromise = !!result && (typeof result === 'object' || typeof result === 'function') && typeof result.then === 'function';
            return isPromise
                ? result.then((data) => classTransformer.plainToInstance(classType, data, params))
                : classTransformer.plainToInstance(classType, result, params);
        };
    };
}
exports.TransformPlainToInstance = TransformPlainToInstance;

},{"../ClassTransformer":23}],33:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Transform = void 0;
const storage_1 = require("../storage");
/**
 * Defines a custom logic for value transformation.
 *
 * Can be applied to properties only.
 */
function Transform(transformFn, options = {}) {
    return function (target, propertyName) {
        storage_1.defaultMetadataStorage.addTransformMetadata({
            target: target.constructor,
            propertyName: propertyName,
            transformFn,
            options,
        });
    };
}
exports.Transform = Transform;

},{"../storage":53}],34:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Type = void 0;
const storage_1 = require("../storage");
/**
 * Specifies a type of the property.
 * The given TypeFunction can return a constructor. A discriminator can be given in the options.
 *
 * Can be applied to properties only.
 */
function Type(typeFunction, options = {}) {
    return function (target, propertyName) {
        const reflectedType = Reflect.getMetadata('design:type', target, propertyName);
        storage_1.defaultMetadataStorage.addTypeMetadata({
            target: target.constructor,
            propertyName: propertyName,
            reflectedType,
            typeFunction,
            options,
        });
    };
}
exports.Type = Type;

},{"../storage":53}],35:[function(require,module,exports){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./transformation-type.enum"), exports);

},{"./transformation-type.enum":36}],36:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransformationType = void 0;
var TransformationType;
(function (TransformationType) {
    TransformationType[TransformationType["PLAIN_TO_CLASS"] = 0] = "PLAIN_TO_CLASS";
    TransformationType[TransformationType["CLASS_TO_PLAIN"] = 1] = "CLASS_TO_PLAIN";
    TransformationType[TransformationType["CLASS_TO_CLASS"] = 2] = "CLASS_TO_CLASS";
})(TransformationType = exports.TransformationType || (exports.TransformationType = {}));

},{}],37:[function(require,module,exports){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deserializeArray = exports.deserialize = exports.serialize = exports.classToClassFromExist = exports.instanceToInstance = exports.plainToClassFromExist = exports.plainToInstance = exports.plainToClass = exports.classToPlainFromExist = exports.instanceToPlain = exports.classToPlain = exports.ClassTransformer = void 0;
const ClassTransformer_1 = require("./ClassTransformer");
var ClassTransformer_2 = require("./ClassTransformer");
Object.defineProperty(exports, "ClassTransformer", { enumerable: true, get: function () { return ClassTransformer_2.ClassTransformer; } });
__exportStar(require("./decorators"), exports);
__exportStar(require("./interfaces"), exports);
__exportStar(require("./enums"), exports);
const classTransformer = new ClassTransformer_1.ClassTransformer();
function classToPlain(object, options) {
    return classTransformer.instanceToPlain(object, options);
}
exports.classToPlain = classToPlain;
function instanceToPlain(object, options) {
    return classTransformer.instanceToPlain(object, options);
}
exports.instanceToPlain = instanceToPlain;
function classToPlainFromExist(object, plainObject, options) {
    return classTransformer.classToPlainFromExist(object, plainObject, options);
}
exports.classToPlainFromExist = classToPlainFromExist;
function plainToClass(cls, plain, options) {
    return classTransformer.plainToInstance(cls, plain, options);
}
exports.plainToClass = plainToClass;
function plainToInstance(cls, plain, options) {
    return classTransformer.plainToInstance(cls, plain, options);
}
exports.plainToInstance = plainToInstance;
function plainToClassFromExist(clsObject, plain, options) {
    return classTransformer.plainToClassFromExist(clsObject, plain, options);
}
exports.plainToClassFromExist = plainToClassFromExist;
function instanceToInstance(object, options) {
    return classTransformer.instanceToInstance(object, options);
}
exports.instanceToInstance = instanceToInstance;
function classToClassFromExist(object, fromObject, options) {
    return classTransformer.classToClassFromExist(object, fromObject, options);
}
exports.classToClassFromExist = classToClassFromExist;
function serialize(object, options) {
    return classTransformer.serialize(object, options);
}
exports.serialize = serialize;
/**
 * Deserializes given JSON string to a object of the given class.
 *
 * @deprecated This function is being removed. Please use the following instead:
 * ```
 * instanceToClass(cls, JSON.parse(json), options)
 * ```
 */
function deserialize(cls, json, options) {
    return classTransformer.deserialize(cls, json, options);
}
exports.deserialize = deserialize;
/**
 * Deserializes given JSON string to an array of objects of the given class.
 *
 * @deprecated This function is being removed. Please use the following instead:
 * ```
 * JSON.parse(json).map(value => instanceToClass(cls, value, options))
 * ```
 *
 */
function deserializeArray(cls, json, options) {
    return classTransformer.deserializeArray(cls, json, options);
}
exports.deserializeArray = deserializeArray;

},{"./ClassTransformer":23,"./decorators":29,"./enums":35,"./interfaces":45}],38:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],39:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],40:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],41:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],42:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],43:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],44:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],45:[function(require,module,exports){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./decorator-options/expose-options.interface"), exports);
__exportStar(require("./decorator-options/exclude-options.interface"), exports);
__exportStar(require("./decorator-options/transform-options.interface"), exports);
__exportStar(require("./decorator-options/type-discriminator-descriptor.interface"), exports);
__exportStar(require("./decorator-options/type-options.interface"), exports);
__exportStar(require("./metadata/exclude-metadata.interface"), exports);
__exportStar(require("./metadata/expose-metadata.interface"), exports);
__exportStar(require("./metadata/transform-metadata.interface"), exports);
__exportStar(require("./metadata/transform-fn-params.interface"), exports);
__exportStar(require("./metadata/type-metadata.interface"), exports);
__exportStar(require("./class-constructor.type"), exports);
__exportStar(require("./class-transformer-options.interface"), exports);
__exportStar(require("./target-map.interface"), exports);
__exportStar(require("./type-help-options.interface"), exports);

},{"./class-constructor.type":38,"./class-transformer-options.interface":39,"./decorator-options/exclude-options.interface":40,"./decorator-options/expose-options.interface":41,"./decorator-options/transform-options.interface":42,"./decorator-options/type-discriminator-descriptor.interface":43,"./decorator-options/type-options.interface":44,"./metadata/exclude-metadata.interface":46,"./metadata/expose-metadata.interface":47,"./metadata/transform-fn-params.interface":48,"./metadata/transform-metadata.interface":49,"./metadata/type-metadata.interface":50,"./target-map.interface":51,"./type-help-options.interface":52}],46:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],47:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],48:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],49:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],50:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],51:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],52:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},{}],53:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultMetadataStorage = void 0;
const MetadataStorage_1 = require("./MetadataStorage");
/**
 * Default metadata storage is used as singleton and can be used to storage all metadatas.
 */
exports.defaultMetadataStorage = new MetadataStorage_1.MetadataStorage();
window.defaultMetadataStorage = exports.defaultMetadataStorage;

},{"./MetadataStorage":24}],54:[function(require,module,exports){
(function (global){(function (){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGlobal = void 0;
/**
 * This function returns the global object across Node and browsers.
 *
 * Note: `globalThis` is the standardized approach however it has been added to
 * Node.js in version 12. We need to include this snippet until Node 12 EOL.
 */
function getGlobal() {
    if (typeof globalThis !== 'undefined') {
        return globalThis;
    }
    if (typeof global !== 'undefined') {
        return global;
    }
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore: Cannot find name 'window'.
    if (typeof window !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore: Cannot find name 'window'.
        return window;
    }
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore: Cannot find name 'self'.
    if (typeof self !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore: Cannot find name 'self'.
        return self;
    }
}
exports.getGlobal = getGlobal;

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],55:[function(require,module,exports){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./get-global.util"), exports);
__exportStar(require("./is-promise.util"), exports);

},{"./get-global.util":54,"./is-promise.util":56}],56:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPromise = void 0;
function isPromise(p) {
    return p !== null && typeof p === 'object' && typeof p.then === 'function';
}
exports.isPromise = isPromise;

},{}],57:[function(require,module,exports){
(function (process,global){(function (){
/*! *****************************************************************************
Copyright (C) Microsoft. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
var Reflect;
(function (Reflect) {
    // Metadata Proposal
    // https://rbuckton.github.io/reflect-metadata/
    (function (factory) {
        var root = typeof global === "object" ? global :
            typeof self === "object" ? self :
                typeof this === "object" ? this :
                    Function("return this;")();
        var exporter = makeExporter(Reflect);
        if (typeof root.Reflect === "undefined") {
            root.Reflect = Reflect;
        }
        else {
            exporter = makeExporter(root.Reflect, exporter);
        }
        factory(exporter);
        function makeExporter(target, previous) {
            return function (key, value) {
                if (typeof target[key] !== "function") {
                    Object.defineProperty(target, key, { configurable: true, writable: true, value: value });
                }
                if (previous)
                    previous(key, value);
            };
        }
    })(function (exporter) {
        var hasOwn = Object.prototype.hasOwnProperty;
        // feature test for Symbol support
        var supportsSymbol = typeof Symbol === "function";
        var toPrimitiveSymbol = supportsSymbol && typeof Symbol.toPrimitive !== "undefined" ? Symbol.toPrimitive : "@@toPrimitive";
        var iteratorSymbol = supportsSymbol && typeof Symbol.iterator !== "undefined" ? Symbol.iterator : "@@iterator";
        var supportsCreate = typeof Object.create === "function"; // feature test for Object.create support
        var supportsProto = { __proto__: [] } instanceof Array; // feature test for __proto__ support
        var downLevel = !supportsCreate && !supportsProto;
        var HashMap = {
            // create an object in dictionary mode (a.k.a. "slow" mode in v8)
            create: supportsCreate
                ? function () { return MakeDictionary(Object.create(null)); }
                : supportsProto
                    ? function () { return MakeDictionary({ __proto__: null }); }
                    : function () { return MakeDictionary({}); },
            has: downLevel
                ? function (map, key) { return hasOwn.call(map, key); }
                : function (map, key) { return key in map; },
            get: downLevel
                ? function (map, key) { return hasOwn.call(map, key) ? map[key] : undefined; }
                : function (map, key) { return map[key]; },
        };
        // Load global or shim versions of Map, Set, and WeakMap
        var functionPrototype = Object.getPrototypeOf(Function);
        var usePolyfill = typeof process === "object" && process.env && process.env["REFLECT_METADATA_USE_MAP_POLYFILL"] === "true";
        var _Map = !usePolyfill && typeof Map === "function" && typeof Map.prototype.entries === "function" ? Map : CreateMapPolyfill();
        var _Set = !usePolyfill && typeof Set === "function" && typeof Set.prototype.entries === "function" ? Set : CreateSetPolyfill();
        var _WeakMap = !usePolyfill && typeof WeakMap === "function" ? WeakMap : CreateWeakMapPolyfill();
        // [[Metadata]] internal slot
        // https://rbuckton.github.io/reflect-metadata/#ordinary-object-internal-methods-and-internal-slots
        var Metadata = new _WeakMap();
        /**
         * Applies a set of decorators to a property of a target object.
         * @param decorators An array of decorators.
         * @param target The target object.
         * @param propertyKey (Optional) The property key to decorate.
         * @param attributes (Optional) The property descriptor for the target key.
         * @remarks Decorators are applied in reverse order.
         * @example
         *
         *     class Example {
         *         // property declarations are not part of ES6, though they are valid in TypeScript:
         *         // static staticProperty;
         *         // property;
         *
         *         constructor(p) { }
         *         static staticMethod(p) { }
         *         method(p) { }
         *     }
         *
         *     // constructor
         *     Example = Reflect.decorate(decoratorsArray, Example);
         *
         *     // property (on constructor)
         *     Reflect.decorate(decoratorsArray, Example, "staticProperty");
         *
         *     // property (on prototype)
         *     Reflect.decorate(decoratorsArray, Example.prototype, "property");
         *
         *     // method (on constructor)
         *     Object.defineProperty(Example, "staticMethod",
         *         Reflect.decorate(decoratorsArray, Example, "staticMethod",
         *             Object.getOwnPropertyDescriptor(Example, "staticMethod")));
         *
         *     // method (on prototype)
         *     Object.defineProperty(Example.prototype, "method",
         *         Reflect.decorate(decoratorsArray, Example.prototype, "method",
         *             Object.getOwnPropertyDescriptor(Example.prototype, "method")));
         *
         */
        function decorate(decorators, target, propertyKey, attributes) {
            if (!IsUndefined(propertyKey)) {
                if (!IsArray(decorators))
                    throw new TypeError();
                if (!IsObject(target))
                    throw new TypeError();
                if (!IsObject(attributes) && !IsUndefined(attributes) && !IsNull(attributes))
                    throw new TypeError();
                if (IsNull(attributes))
                    attributes = undefined;
                propertyKey = ToPropertyKey(propertyKey);
                return DecorateProperty(decorators, target, propertyKey, attributes);
            }
            else {
                if (!IsArray(decorators))
                    throw new TypeError();
                if (!IsConstructor(target))
                    throw new TypeError();
                return DecorateConstructor(decorators, target);
            }
        }
        exporter("decorate", decorate);
        // 4.1.2 Reflect.metadata(metadataKey, metadataValue)
        // https://rbuckton.github.io/reflect-metadata/#reflect.metadata
        /**
         * A default metadata decorator factory that can be used on a class, class member, or parameter.
         * @param metadataKey The key for the metadata entry.
         * @param metadataValue The value for the metadata entry.
         * @returns A decorator function.
         * @remarks
         * If `metadataKey` is already defined for the target and target key, the
         * metadataValue for that key will be overwritten.
         * @example
         *
         *     // constructor
         *     @Reflect.metadata(key, value)
         *     class Example {
         *     }
         *
         *     // property (on constructor, TypeScript only)
         *     class Example {
         *         @Reflect.metadata(key, value)
         *         static staticProperty;
         *     }
         *
         *     // property (on prototype, TypeScript only)
         *     class Example {
         *         @Reflect.metadata(key, value)
         *         property;
         *     }
         *
         *     // method (on constructor)
         *     class Example {
         *         @Reflect.metadata(key, value)
         *         static staticMethod() { }
         *     }
         *
         *     // method (on prototype)
         *     class Example {
         *         @Reflect.metadata(key, value)
         *         method() { }
         *     }
         *
         */
        function metadata(metadataKey, metadataValue) {
            function decorator(target, propertyKey) {
                if (!IsObject(target))
                    throw new TypeError();
                if (!IsUndefined(propertyKey) && !IsPropertyKey(propertyKey))
                    throw new TypeError();
                OrdinaryDefineOwnMetadata(metadataKey, metadataValue, target, propertyKey);
            }
            return decorator;
        }
        exporter("metadata", metadata);
        /**
         * Define a unique metadata entry on the target.
         * @param metadataKey A key used to store and retrieve metadata.
         * @param metadataValue A value that contains attached metadata.
         * @param target The target object on which to define metadata.
         * @param propertyKey (Optional) The property key for the target.
         * @example
         *
         *     class Example {
         *         // property declarations are not part of ES6, though they are valid in TypeScript:
         *         // static staticProperty;
         *         // property;
         *
         *         constructor(p) { }
         *         static staticMethod(p) { }
         *         method(p) { }
         *     }
         *
         *     // constructor
         *     Reflect.defineMetadata("custom:annotation", options, Example);
         *
         *     // property (on constructor)
         *     Reflect.defineMetadata("custom:annotation", options, Example, "staticProperty");
         *
         *     // property (on prototype)
         *     Reflect.defineMetadata("custom:annotation", options, Example.prototype, "property");
         *
         *     // method (on constructor)
         *     Reflect.defineMetadata("custom:annotation", options, Example, "staticMethod");
         *
         *     // method (on prototype)
         *     Reflect.defineMetadata("custom:annotation", options, Example.prototype, "method");
         *
         *     // decorator factory as metadata-producing annotation.
         *     function MyAnnotation(options): Decorator {
         *         return (target, key?) => Reflect.defineMetadata("custom:annotation", options, target, key);
         *     }
         *
         */
        function defineMetadata(metadataKey, metadataValue, target, propertyKey) {
            if (!IsObject(target))
                throw new TypeError();
            if (!IsUndefined(propertyKey))
                propertyKey = ToPropertyKey(propertyKey);
            return OrdinaryDefineOwnMetadata(metadataKey, metadataValue, target, propertyKey);
        }
        exporter("defineMetadata", defineMetadata);
        /**
         * Gets a value indicating whether the target object or its prototype chain has the provided metadata key defined.
         * @param metadataKey A key used to store and retrieve metadata.
         * @param target The target object on which the metadata is defined.
         * @param propertyKey (Optional) The property key for the target.
         * @returns `true` if the metadata key was defined on the target object or its prototype chain; otherwise, `false`.
         * @example
         *
         *     class Example {
         *         // property declarations are not part of ES6, though they are valid in TypeScript:
         *         // static staticProperty;
         *         // property;
         *
         *         constructor(p) { }
         *         static staticMethod(p) { }
         *         method(p) { }
         *     }
         *
         *     // constructor
         *     result = Reflect.hasMetadata("custom:annotation", Example);
         *
         *     // property (on constructor)
         *     result = Reflect.hasMetadata("custom:annotation", Example, "staticProperty");
         *
         *     // property (on prototype)
         *     result = Reflect.hasMetadata("custom:annotation", Example.prototype, "property");
         *
         *     // method (on constructor)
         *     result = Reflect.hasMetadata("custom:annotation", Example, "staticMethod");
         *
         *     // method (on prototype)
         *     result = Reflect.hasMetadata("custom:annotation", Example.prototype, "method");
         *
         */
        function hasMetadata(metadataKey, target, propertyKey) {
            if (!IsObject(target))
                throw new TypeError();
            if (!IsUndefined(propertyKey))
                propertyKey = ToPropertyKey(propertyKey);
            return OrdinaryHasMetadata(metadataKey, target, propertyKey);
        }
        exporter("hasMetadata", hasMetadata);
        /**
         * Gets a value indicating whether the target object has the provided metadata key defined.
         * @param metadataKey A key used to store and retrieve metadata.
         * @param target The target object on which the metadata is defined.
         * @param propertyKey (Optional) The property key for the target.
         * @returns `true` if the metadata key was defined on the target object; otherwise, `false`.
         * @example
         *
         *     class Example {
         *         // property declarations are not part of ES6, though they are valid in TypeScript:
         *         // static staticProperty;
         *         // property;
         *
         *         constructor(p) { }
         *         static staticMethod(p) { }
         *         method(p) { }
         *     }
         *
         *     // constructor
         *     result = Reflect.hasOwnMetadata("custom:annotation", Example);
         *
         *     // property (on constructor)
         *     result = Reflect.hasOwnMetadata("custom:annotation", Example, "staticProperty");
         *
         *     // property (on prototype)
         *     result = Reflect.hasOwnMetadata("custom:annotation", Example.prototype, "property");
         *
         *     // method (on constructor)
         *     result = Reflect.hasOwnMetadata("custom:annotation", Example, "staticMethod");
         *
         *     // method (on prototype)
         *     result = Reflect.hasOwnMetadata("custom:annotation", Example.prototype, "method");
         *
         */
        function hasOwnMetadata(metadataKey, target, propertyKey) {
            if (!IsObject(target))
                throw new TypeError();
            if (!IsUndefined(propertyKey))
                propertyKey = ToPropertyKey(propertyKey);
            return OrdinaryHasOwnMetadata(metadataKey, target, propertyKey);
        }
        exporter("hasOwnMetadata", hasOwnMetadata);
        /**
         * Gets the metadata value for the provided metadata key on the target object or its prototype chain.
         * @param metadataKey A key used to store and retrieve metadata.
         * @param target The target object on which the metadata is defined.
         * @param propertyKey (Optional) The property key for the target.
         * @returns The metadata value for the metadata key if found; otherwise, `undefined`.
         * @example
         *
         *     class Example {
         *         // property declarations are not part of ES6, though they are valid in TypeScript:
         *         // static staticProperty;
         *         // property;
         *
         *         constructor(p) { }
         *         static staticMethod(p) { }
         *         method(p) { }
         *     }
         *
         *     // constructor
         *     result = Reflect.getMetadata("custom:annotation", Example);
         *
         *     // property (on constructor)
         *     result = Reflect.getMetadata("custom:annotation", Example, "staticProperty");
         *
         *     // property (on prototype)
         *     result = Reflect.getMetadata("custom:annotation", Example.prototype, "property");
         *
         *     // method (on constructor)
         *     result = Reflect.getMetadata("custom:annotation", Example, "staticMethod");
         *
         *     // method (on prototype)
         *     result = Reflect.getMetadata("custom:annotation", Example.prototype, "method");
         *
         */
        function getMetadata(metadataKey, target, propertyKey) {
            if (!IsObject(target))
                throw new TypeError();
            if (!IsUndefined(propertyKey))
                propertyKey = ToPropertyKey(propertyKey);
            return OrdinaryGetMetadata(metadataKey, target, propertyKey);
        }
        exporter("getMetadata", getMetadata);
        /**
         * Gets the metadata value for the provided metadata key on the target object.
         * @param metadataKey A key used to store and retrieve metadata.
         * @param target The target object on which the metadata is defined.
         * @param propertyKey (Optional) The property key for the target.
         * @returns The metadata value for the metadata key if found; otherwise, `undefined`.
         * @example
         *
         *     class Example {
         *         // property declarations are not part of ES6, though they are valid in TypeScript:
         *         // static staticProperty;
         *         // property;
         *
         *         constructor(p) { }
         *         static staticMethod(p) { }
         *         method(p) { }
         *     }
         *
         *     // constructor
         *     result = Reflect.getOwnMetadata("custom:annotation", Example);
         *
         *     // property (on constructor)
         *     result = Reflect.getOwnMetadata("custom:annotation", Example, "staticProperty");
         *
         *     // property (on prototype)
         *     result = Reflect.getOwnMetadata("custom:annotation", Example.prototype, "property");
         *
         *     // method (on constructor)
         *     result = Reflect.getOwnMetadata("custom:annotation", Example, "staticMethod");
         *
         *     // method (on prototype)
         *     result = Reflect.getOwnMetadata("custom:annotation", Example.prototype, "method");
         *
         */
        function getOwnMetadata(metadataKey, target, propertyKey) {
            if (!IsObject(target))
                throw new TypeError();
            if (!IsUndefined(propertyKey))
                propertyKey = ToPropertyKey(propertyKey);
            return OrdinaryGetOwnMetadata(metadataKey, target, propertyKey);
        }
        exporter("getOwnMetadata", getOwnMetadata);
        /**
         * Gets the metadata keys defined on the target object or its prototype chain.
         * @param target The target object on which the metadata is defined.
         * @param propertyKey (Optional) The property key for the target.
         * @returns An array of unique metadata keys.
         * @example
         *
         *     class Example {
         *         // property declarations are not part of ES6, though they are valid in TypeScript:
         *         // static staticProperty;
         *         // property;
         *
         *         constructor(p) { }
         *         static staticMethod(p) { }
         *         method(p) { }
         *     }
         *
         *     // constructor
         *     result = Reflect.getMetadataKeys(Example);
         *
         *     // property (on constructor)
         *     result = Reflect.getMetadataKeys(Example, "staticProperty");
         *
         *     // property (on prototype)
         *     result = Reflect.getMetadataKeys(Example.prototype, "property");
         *
         *     // method (on constructor)
         *     result = Reflect.getMetadataKeys(Example, "staticMethod");
         *
         *     // method (on prototype)
         *     result = Reflect.getMetadataKeys(Example.prototype, "method");
         *
         */
        function getMetadataKeys(target, propertyKey) {
            if (!IsObject(target))
                throw new TypeError();
            if (!IsUndefined(propertyKey))
                propertyKey = ToPropertyKey(propertyKey);
            return OrdinaryMetadataKeys(target, propertyKey);
        }
        exporter("getMetadataKeys", getMetadataKeys);
        /**
         * Gets the unique metadata keys defined on the target object.
         * @param target The target object on which the metadata is defined.
         * @param propertyKey (Optional) The property key for the target.
         * @returns An array of unique metadata keys.
         * @example
         *
         *     class Example {
         *         // property declarations are not part of ES6, though they are valid in TypeScript:
         *         // static staticProperty;
         *         // property;
         *
         *         constructor(p) { }
         *         static staticMethod(p) { }
         *         method(p) { }
         *     }
         *
         *     // constructor
         *     result = Reflect.getOwnMetadataKeys(Example);
         *
         *     // property (on constructor)
         *     result = Reflect.getOwnMetadataKeys(Example, "staticProperty");
         *
         *     // property (on prototype)
         *     result = Reflect.getOwnMetadataKeys(Example.prototype, "property");
         *
         *     // method (on constructor)
         *     result = Reflect.getOwnMetadataKeys(Example, "staticMethod");
         *
         *     // method (on prototype)
         *     result = Reflect.getOwnMetadataKeys(Example.prototype, "method");
         *
         */
        function getOwnMetadataKeys(target, propertyKey) {
            if (!IsObject(target))
                throw new TypeError();
            if (!IsUndefined(propertyKey))
                propertyKey = ToPropertyKey(propertyKey);
            return OrdinaryOwnMetadataKeys(target, propertyKey);
        }
        exporter("getOwnMetadataKeys", getOwnMetadataKeys);
        /**
         * Deletes the metadata entry from the target object with the provided key.
         * @param metadataKey A key used to store and retrieve metadata.
         * @param target The target object on which the metadata is defined.
         * @param propertyKey (Optional) The property key for the target.
         * @returns `true` if the metadata entry was found and deleted; otherwise, false.
         * @example
         *
         *     class Example {
         *         // property declarations are not part of ES6, though they are valid in TypeScript:
         *         // static staticProperty;
         *         // property;
         *
         *         constructor(p) { }
         *         static staticMethod(p) { }
         *         method(p) { }
         *     }
         *
         *     // constructor
         *     result = Reflect.deleteMetadata("custom:annotation", Example);
         *
         *     // property (on constructor)
         *     result = Reflect.deleteMetadata("custom:annotation", Example, "staticProperty");
         *
         *     // property (on prototype)
         *     result = Reflect.deleteMetadata("custom:annotation", Example.prototype, "property");
         *
         *     // method (on constructor)
         *     result = Reflect.deleteMetadata("custom:annotation", Example, "staticMethod");
         *
         *     // method (on prototype)
         *     result = Reflect.deleteMetadata("custom:annotation", Example.prototype, "method");
         *
         */
        function deleteMetadata(metadataKey, target, propertyKey) {
            if (!IsObject(target))
                throw new TypeError();
            if (!IsUndefined(propertyKey))
                propertyKey = ToPropertyKey(propertyKey);
            var metadataMap = GetOrCreateMetadataMap(target, propertyKey, /*Create*/ false);
            if (IsUndefined(metadataMap))
                return false;
            if (!metadataMap.delete(metadataKey))
                return false;
            if (metadataMap.size > 0)
                return true;
            var targetMetadata = Metadata.get(target);
            targetMetadata.delete(propertyKey);
            if (targetMetadata.size > 0)
                return true;
            Metadata.delete(target);
            return true;
        }
        exporter("deleteMetadata", deleteMetadata);
        function DecorateConstructor(decorators, target) {
            for (var i = decorators.length - 1; i >= 0; --i) {
                var decorator = decorators[i];
                var decorated = decorator(target);
                if (!IsUndefined(decorated) && !IsNull(decorated)) {
                    if (!IsConstructor(decorated))
                        throw new TypeError();
                    target = decorated;
                }
            }
            return target;
        }
        function DecorateProperty(decorators, target, propertyKey, descriptor) {
            for (var i = decorators.length - 1; i >= 0; --i) {
                var decorator = decorators[i];
                var decorated = decorator(target, propertyKey, descriptor);
                if (!IsUndefined(decorated) && !IsNull(decorated)) {
                    if (!IsObject(decorated))
                        throw new TypeError();
                    descriptor = decorated;
                }
            }
            return descriptor;
        }
        function GetOrCreateMetadataMap(O, P, Create) {
            var targetMetadata = Metadata.get(O);
            if (IsUndefined(targetMetadata)) {
                if (!Create)
                    return undefined;
                targetMetadata = new _Map();
                Metadata.set(O, targetMetadata);
            }
            var metadataMap = targetMetadata.get(P);
            if (IsUndefined(metadataMap)) {
                if (!Create)
                    return undefined;
                metadataMap = new _Map();
                targetMetadata.set(P, metadataMap);
            }
            return metadataMap;
        }
        // 3.1.1.1 OrdinaryHasMetadata(MetadataKey, O, P)
        // https://rbuckton.github.io/reflect-metadata/#ordinaryhasmetadata
        function OrdinaryHasMetadata(MetadataKey, O, P) {
            var hasOwn = OrdinaryHasOwnMetadata(MetadataKey, O, P);
            if (hasOwn)
                return true;
            var parent = OrdinaryGetPrototypeOf(O);
            if (!IsNull(parent))
                return OrdinaryHasMetadata(MetadataKey, parent, P);
            return false;
        }
        // 3.1.2.1 OrdinaryHasOwnMetadata(MetadataKey, O, P)
        // https://rbuckton.github.io/reflect-metadata/#ordinaryhasownmetadata
        function OrdinaryHasOwnMetadata(MetadataKey, O, P) {
            var metadataMap = GetOrCreateMetadataMap(O, P, /*Create*/ false);
            if (IsUndefined(metadataMap))
                return false;
            return ToBoolean(metadataMap.has(MetadataKey));
        }
        // 3.1.3.1 OrdinaryGetMetadata(MetadataKey, O, P)
        // https://rbuckton.github.io/reflect-metadata/#ordinarygetmetadata
        function OrdinaryGetMetadata(MetadataKey, O, P) {
            var hasOwn = OrdinaryHasOwnMetadata(MetadataKey, O, P);
            if (hasOwn)
                return OrdinaryGetOwnMetadata(MetadataKey, O, P);
            var parent = OrdinaryGetPrototypeOf(O);
            if (!IsNull(parent))
                return OrdinaryGetMetadata(MetadataKey, parent, P);
            return undefined;
        }
        // 3.1.4.1 OrdinaryGetOwnMetadata(MetadataKey, O, P)
        // https://rbuckton.github.io/reflect-metadata/#ordinarygetownmetadata
        function OrdinaryGetOwnMetadata(MetadataKey, O, P) {
            var metadataMap = GetOrCreateMetadataMap(O, P, /*Create*/ false);
            if (IsUndefined(metadataMap))
                return undefined;
            return metadataMap.get(MetadataKey);
        }
        // 3.1.5.1 OrdinaryDefineOwnMetadata(MetadataKey, MetadataValue, O, P)
        // https://rbuckton.github.io/reflect-metadata/#ordinarydefineownmetadata
        function OrdinaryDefineOwnMetadata(MetadataKey, MetadataValue, O, P) {
            var metadataMap = GetOrCreateMetadataMap(O, P, /*Create*/ true);
            metadataMap.set(MetadataKey, MetadataValue);
        }
        // 3.1.6.1 OrdinaryMetadataKeys(O, P)
        // https://rbuckton.github.io/reflect-metadata/#ordinarymetadatakeys
        function OrdinaryMetadataKeys(O, P) {
            var ownKeys = OrdinaryOwnMetadataKeys(O, P);
            var parent = OrdinaryGetPrototypeOf(O);
            if (parent === null)
                return ownKeys;
            var parentKeys = OrdinaryMetadataKeys(parent, P);
            if (parentKeys.length <= 0)
                return ownKeys;
            if (ownKeys.length <= 0)
                return parentKeys;
            var set = new _Set();
            var keys = [];
            for (var _i = 0, ownKeys_1 = ownKeys; _i < ownKeys_1.length; _i++) {
                var key = ownKeys_1[_i];
                var hasKey = set.has(key);
                if (!hasKey) {
                    set.add(key);
                    keys.push(key);
                }
            }
            for (var _a = 0, parentKeys_1 = parentKeys; _a < parentKeys_1.length; _a++) {
                var key = parentKeys_1[_a];
                var hasKey = set.has(key);
                if (!hasKey) {
                    set.add(key);
                    keys.push(key);
                }
            }
            return keys;
        }
        // 3.1.7.1 OrdinaryOwnMetadataKeys(O, P)
        // https://rbuckton.github.io/reflect-metadata/#ordinaryownmetadatakeys
        function OrdinaryOwnMetadataKeys(O, P) {
            var keys = [];
            var metadataMap = GetOrCreateMetadataMap(O, P, /*Create*/ false);
            if (IsUndefined(metadataMap))
                return keys;
            var keysObj = metadataMap.keys();
            var iterator = GetIterator(keysObj);
            var k = 0;
            while (true) {
                var next = IteratorStep(iterator);
                if (!next) {
                    keys.length = k;
                    return keys;
                }
                var nextValue = IteratorValue(next);
                try {
                    keys[k] = nextValue;
                }
                catch (e) {
                    try {
                        IteratorClose(iterator);
                    }
                    finally {
                        throw e;
                    }
                }
                k++;
            }
        }
        // 6 ECMAScript Data Typ0es and Values
        // https://tc39.github.io/ecma262/#sec-ecmascript-data-types-and-values
        function Type(x) {
            if (x === null)
                return 1 /* Null */;
            switch (typeof x) {
                case "undefined": return 0 /* Undefined */;
                case "boolean": return 2 /* Boolean */;
                case "string": return 3 /* String */;
                case "symbol": return 4 /* Symbol */;
                case "number": return 5 /* Number */;
                case "object": return x === null ? 1 /* Null */ : 6 /* Object */;
                default: return 6 /* Object */;
            }
        }
        // 6.1.1 The Undefined Type
        // https://tc39.github.io/ecma262/#sec-ecmascript-language-types-undefined-type
        function IsUndefined(x) {
            return x === undefined;
        }
        // 6.1.2 The Null Type
        // https://tc39.github.io/ecma262/#sec-ecmascript-language-types-null-type
        function IsNull(x) {
            return x === null;
        }
        // 6.1.5 The Symbol Type
        // https://tc39.github.io/ecma262/#sec-ecmascript-language-types-symbol-type
        function IsSymbol(x) {
            return typeof x === "symbol";
        }
        // 6.1.7 The Object Type
        // https://tc39.github.io/ecma262/#sec-object-type
        function IsObject(x) {
            return typeof x === "object" ? x !== null : typeof x === "function";
        }
        // 7.1 Type Conversion
        // https://tc39.github.io/ecma262/#sec-type-conversion
        // 7.1.1 ToPrimitive(input [, PreferredType])
        // https://tc39.github.io/ecma262/#sec-toprimitive
        function ToPrimitive(input, PreferredType) {
            switch (Type(input)) {
                case 0 /* Undefined */: return input;
                case 1 /* Null */: return input;
                case 2 /* Boolean */: return input;
                case 3 /* String */: return input;
                case 4 /* Symbol */: return input;
                case 5 /* Number */: return input;
            }
            var hint = PreferredType === 3 /* String */ ? "string" : PreferredType === 5 /* Number */ ? "number" : "default";
            var exoticToPrim = GetMethod(input, toPrimitiveSymbol);
            if (exoticToPrim !== undefined) {
                var result = exoticToPrim.call(input, hint);
                if (IsObject(result))
                    throw new TypeError();
                return result;
            }
            return OrdinaryToPrimitive(input, hint === "default" ? "number" : hint);
        }
        // 7.1.1.1 OrdinaryToPrimitive(O, hint)
        // https://tc39.github.io/ecma262/#sec-ordinarytoprimitive
        function OrdinaryToPrimitive(O, hint) {
            if (hint === "string") {
                var toString_1 = O.toString;
                if (IsCallable(toString_1)) {
                    var result = toString_1.call(O);
                    if (!IsObject(result))
                        return result;
                }
                var valueOf = O.valueOf;
                if (IsCallable(valueOf)) {
                    var result = valueOf.call(O);
                    if (!IsObject(result))
                        return result;
                }
            }
            else {
                var valueOf = O.valueOf;
                if (IsCallable(valueOf)) {
                    var result = valueOf.call(O);
                    if (!IsObject(result))
                        return result;
                }
                var toString_2 = O.toString;
                if (IsCallable(toString_2)) {
                    var result = toString_2.call(O);
                    if (!IsObject(result))
                        return result;
                }
            }
            throw new TypeError();
        }
        // 7.1.2 ToBoolean(argument)
        // https://tc39.github.io/ecma262/2016/#sec-toboolean
        function ToBoolean(argument) {
            return !!argument;
        }
        // 7.1.12 ToString(argument)
        // https://tc39.github.io/ecma262/#sec-tostring
        function ToString(argument) {
            return "" + argument;
        }
        // 7.1.14 ToPropertyKey(argument)
        // https://tc39.github.io/ecma262/#sec-topropertykey
        function ToPropertyKey(argument) {
            var key = ToPrimitive(argument, 3 /* String */);
            if (IsSymbol(key))
                return key;
            return ToString(key);
        }
        // 7.2 Testing and Comparison Operations
        // https://tc39.github.io/ecma262/#sec-testing-and-comparison-operations
        // 7.2.2 IsArray(argument)
        // https://tc39.github.io/ecma262/#sec-isarray
        function IsArray(argument) {
            return Array.isArray
                ? Array.isArray(argument)
                : argument instanceof Object
                    ? argument instanceof Array
                    : Object.prototype.toString.call(argument) === "[object Array]";
        }
        // 7.2.3 IsCallable(argument)
        // https://tc39.github.io/ecma262/#sec-iscallable
        function IsCallable(argument) {
            // NOTE: This is an approximation as we cannot check for [[Call]] internal method.
            return typeof argument === "function";
        }
        // 7.2.4 IsConstructor(argument)
        // https://tc39.github.io/ecma262/#sec-isconstructor
        function IsConstructor(argument) {
            // NOTE: This is an approximation as we cannot check for [[Construct]] internal method.
            return typeof argument === "function";
        }
        // 7.2.7 IsPropertyKey(argument)
        // https://tc39.github.io/ecma262/#sec-ispropertykey
        function IsPropertyKey(argument) {
            switch (Type(argument)) {
                case 3 /* String */: return true;
                case 4 /* Symbol */: return true;
                default: return false;
            }
        }
        // 7.3 Operations on Objects
        // https://tc39.github.io/ecma262/#sec-operations-on-objects
        // 7.3.9 GetMethod(V, P)
        // https://tc39.github.io/ecma262/#sec-getmethod
        function GetMethod(V, P) {
            var func = V[P];
            if (func === undefined || func === null)
                return undefined;
            if (!IsCallable(func))
                throw new TypeError();
            return func;
        }
        // 7.4 Operations on Iterator Objects
        // https://tc39.github.io/ecma262/#sec-operations-on-iterator-objects
        function GetIterator(obj) {
            var method = GetMethod(obj, iteratorSymbol);
            if (!IsCallable(method))
                throw new TypeError(); // from Call
            var iterator = method.call(obj);
            if (!IsObject(iterator))
                throw new TypeError();
            return iterator;
        }
        // 7.4.4 IteratorValue(iterResult)
        // https://tc39.github.io/ecma262/2016/#sec-iteratorvalue
        function IteratorValue(iterResult) {
            return iterResult.value;
        }
        // 7.4.5 IteratorStep(iterator)
        // https://tc39.github.io/ecma262/#sec-iteratorstep
        function IteratorStep(iterator) {
            var result = iterator.next();
            return result.done ? false : result;
        }
        // 7.4.6 IteratorClose(iterator, completion)
        // https://tc39.github.io/ecma262/#sec-iteratorclose
        function IteratorClose(iterator) {
            var f = iterator["return"];
            if (f)
                f.call(iterator);
        }
        // 9.1 Ordinary Object Internal Methods and Internal Slots
        // https://tc39.github.io/ecma262/#sec-ordinary-object-internal-methods-and-internal-slots
        // 9.1.1.1 OrdinaryGetPrototypeOf(O)
        // https://tc39.github.io/ecma262/#sec-ordinarygetprototypeof
        function OrdinaryGetPrototypeOf(O) {
            var proto = Object.getPrototypeOf(O);
            if (typeof O !== "function" || O === functionPrototype)
                return proto;
            // TypeScript doesn't set __proto__ in ES5, as it's non-standard.
            // Try to determine the superclass constructor. Compatible implementations
            // must either set __proto__ on a subclass constructor to the superclass constructor,
            // or ensure each class has a valid `constructor` property on its prototype that
            // points back to the constructor.
            // If this is not the same as Function.[[Prototype]], then this is definately inherited.
            // This is the case when in ES6 or when using __proto__ in a compatible browser.
            if (proto !== functionPrototype)
                return proto;
            // If the super prototype is Object.prototype, null, or undefined, then we cannot determine the heritage.
            var prototype = O.prototype;
            var prototypeProto = prototype && Object.getPrototypeOf(prototype);
            if (prototypeProto == null || prototypeProto === Object.prototype)
                return proto;
            // If the constructor was not a function, then we cannot determine the heritage.
            var constructor = prototypeProto.constructor;
            if (typeof constructor !== "function")
                return proto;
            // If we have some kind of self-reference, then we cannot determine the heritage.
            if (constructor === O)
                return proto;
            // we have a pretty good guess at the heritage.
            return constructor;
        }
        // naive Map shim
        function CreateMapPolyfill() {
            var cacheSentinel = {};
            var arraySentinel = [];
            var MapIterator = /** @class */ (function () {
                function MapIterator(keys, values, selector) {
                    this._index = 0;
                    this._keys = keys;
                    this._values = values;
                    this._selector = selector;
                }
                MapIterator.prototype["@@iterator"] = function () { return this; };
                MapIterator.prototype[iteratorSymbol] = function () { return this; };
                MapIterator.prototype.next = function () {
                    var index = this._index;
                    if (index >= 0 && index < this._keys.length) {
                        var result = this._selector(this._keys[index], this._values[index]);
                        if (index + 1 >= this._keys.length) {
                            this._index = -1;
                            this._keys = arraySentinel;
                            this._values = arraySentinel;
                        }
                        else {
                            this._index++;
                        }
                        return { value: result, done: false };
                    }
                    return { value: undefined, done: true };
                };
                MapIterator.prototype.throw = function (error) {
                    if (this._index >= 0) {
                        this._index = -1;
                        this._keys = arraySentinel;
                        this._values = arraySentinel;
                    }
                    throw error;
                };
                MapIterator.prototype.return = function (value) {
                    if (this._index >= 0) {
                        this._index = -1;
                        this._keys = arraySentinel;
                        this._values = arraySentinel;
                    }
                    return { value: value, done: true };
                };
                return MapIterator;
            }());
            return /** @class */ (function () {
                function Map() {
                    this._keys = [];
                    this._values = [];
                    this._cacheKey = cacheSentinel;
                    this._cacheIndex = -2;
                }
                Object.defineProperty(Map.prototype, "size", {
                    get: function () { return this._keys.length; },
                    enumerable: true,
                    configurable: true
                });
                Map.prototype.has = function (key) { return this._find(key, /*insert*/ false) >= 0; };
                Map.prototype.get = function (key) {
                    var index = this._find(key, /*insert*/ false);
                    return index >= 0 ? this._values[index] : undefined;
                };
                Map.prototype.set = function (key, value) {
                    var index = this._find(key, /*insert*/ true);
                    this._values[index] = value;
                    return this;
                };
                Map.prototype.delete = function (key) {
                    var index = this._find(key, /*insert*/ false);
                    if (index >= 0) {
                        var size = this._keys.length;
                        for (var i = index + 1; i < size; i++) {
                            this._keys[i - 1] = this._keys[i];
                            this._values[i - 1] = this._values[i];
                        }
                        this._keys.length--;
                        this._values.length--;
                        if (key === this._cacheKey) {
                            this._cacheKey = cacheSentinel;
                            this._cacheIndex = -2;
                        }
                        return true;
                    }
                    return false;
                };
                Map.prototype.clear = function () {
                    this._keys.length = 0;
                    this._values.length = 0;
                    this._cacheKey = cacheSentinel;
                    this._cacheIndex = -2;
                };
                Map.prototype.keys = function () { return new MapIterator(this._keys, this._values, getKey); };
                Map.prototype.values = function () { return new MapIterator(this._keys, this._values, getValue); };
                Map.prototype.entries = function () { return new MapIterator(this._keys, this._values, getEntry); };
                Map.prototype["@@iterator"] = function () { return this.entries(); };
                Map.prototype[iteratorSymbol] = function () { return this.entries(); };
                Map.prototype._find = function (key, insert) {
                    if (this._cacheKey !== key) {
                        this._cacheIndex = this._keys.indexOf(this._cacheKey = key);
                    }
                    if (this._cacheIndex < 0 && insert) {
                        this._cacheIndex = this._keys.length;
                        this._keys.push(key);
                        this._values.push(undefined);
                    }
                    return this._cacheIndex;
                };
                return Map;
            }());
            function getKey(key, _) {
                return key;
            }
            function getValue(_, value) {
                return value;
            }
            function getEntry(key, value) {
                return [key, value];
            }
        }
        // naive Set shim
        function CreateSetPolyfill() {
            return /** @class */ (function () {
                function Set() {
                    this._map = new _Map();
                }
                Object.defineProperty(Set.prototype, "size", {
                    get: function () { return this._map.size; },
                    enumerable: true,
                    configurable: true
                });
                Set.prototype.has = function (value) { return this._map.has(value); };
                Set.prototype.add = function (value) { return this._map.set(value, value), this; };
                Set.prototype.delete = function (value) { return this._map.delete(value); };
                Set.prototype.clear = function () { this._map.clear(); };
                Set.prototype.keys = function () { return this._map.keys(); };
                Set.prototype.values = function () { return this._map.values(); };
                Set.prototype.entries = function () { return this._map.entries(); };
                Set.prototype["@@iterator"] = function () { return this.keys(); };
                Set.prototype[iteratorSymbol] = function () { return this.keys(); };
                return Set;
            }());
        }
        // naive WeakMap shim
        function CreateWeakMapPolyfill() {
            var UUID_SIZE = 16;
            var keys = HashMap.create();
            var rootKey = CreateUniqueKey();
            return /** @class */ (function () {
                function WeakMap() {
                    this._key = CreateUniqueKey();
                }
                WeakMap.prototype.has = function (target) {
                    var table = GetOrCreateWeakMapTable(target, /*create*/ false);
                    return table !== undefined ? HashMap.has(table, this._key) : false;
                };
                WeakMap.prototype.get = function (target) {
                    var table = GetOrCreateWeakMapTable(target, /*create*/ false);
                    return table !== undefined ? HashMap.get(table, this._key) : undefined;
                };
                WeakMap.prototype.set = function (target, value) {
                    var table = GetOrCreateWeakMapTable(target, /*create*/ true);
                    table[this._key] = value;
                    return this;
                };
                WeakMap.prototype.delete = function (target) {
                    var table = GetOrCreateWeakMapTable(target, /*create*/ false);
                    return table !== undefined ? delete table[this._key] : false;
                };
                WeakMap.prototype.clear = function () {
                    // NOTE: not a real clear, just makes the previous data unreachable
                    this._key = CreateUniqueKey();
                };
                return WeakMap;
            }());
            function CreateUniqueKey() {
                var key;
                do
                    key = "@@WeakMap@@" + CreateUUID();
                while (HashMap.has(keys, key));
                keys[key] = true;
                return key;
            }
            function GetOrCreateWeakMapTable(target, create) {
                if (!hasOwn.call(target, rootKey)) {
                    if (!create)
                        return undefined;
                    Object.defineProperty(target, rootKey, { value: HashMap.create() });
                }
                return target[rootKey];
            }
            function FillRandomBytes(buffer, size) {
                for (var i = 0; i < size; ++i)
                    buffer[i] = Math.random() * 0xff | 0;
                return buffer;
            }
            function GenRandomBytes(size) {
                if (typeof Uint8Array === "function") {
                    if (typeof crypto !== "undefined")
                        return crypto.getRandomValues(new Uint8Array(size));
                    if (typeof msCrypto !== "undefined")
                        return msCrypto.getRandomValues(new Uint8Array(size));
                    return FillRandomBytes(new Uint8Array(size), size);
                }
                return FillRandomBytes(new Array(size), size);
            }
            function CreateUUID() {
                var data = GenRandomBytes(UUID_SIZE);
                // mark as random - RFC 4122 § 4.4
                data[6] = data[6] & 0x4f | 0x40;
                data[8] = data[8] & 0xbf | 0x80;
                var result = "";
                for (var offset = 0; offset < UUID_SIZE; ++offset) {
                    var byte = data[offset];
                    if (offset === 4 || offset === 6 || offset === 8)
                        result += "-";
                    if (byte < 16)
                        result += "0";
                    result += byte.toString(16).toLowerCase();
                }
                return result;
            }
        }
        // uses a heuristic used by v8 and chakra to force an object into dictionary mode.
        function MakeDictionary(obj) {
            obj.__ = undefined;
            delete obj.__;
            return obj;
        }
    });
})(Reflect || (Reflect = {}));

}).call(this)}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"_process":77}],58:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "NIL", {
  enumerable: true,
  get: function () {
    return _nil.default;
  }
});
Object.defineProperty(exports, "parse", {
  enumerable: true,
  get: function () {
    return _parse.default;
  }
});
Object.defineProperty(exports, "stringify", {
  enumerable: true,
  get: function () {
    return _stringify.default;
  }
});
Object.defineProperty(exports, "v1", {
  enumerable: true,
  get: function () {
    return _v.default;
  }
});
Object.defineProperty(exports, "v3", {
  enumerable: true,
  get: function () {
    return _v2.default;
  }
});
Object.defineProperty(exports, "v4", {
  enumerable: true,
  get: function () {
    return _v3.default;
  }
});
Object.defineProperty(exports, "v5", {
  enumerable: true,
  get: function () {
    return _v4.default;
  }
});
Object.defineProperty(exports, "validate", {
  enumerable: true,
  get: function () {
    return _validate.default;
  }
});
Object.defineProperty(exports, "version", {
  enumerable: true,
  get: function () {
    return _version.default;
  }
});

var _v = _interopRequireDefault(require("./v1.js"));

var _v2 = _interopRequireDefault(require("./v3.js"));

var _v3 = _interopRequireDefault(require("./v4.js"));

var _v4 = _interopRequireDefault(require("./v5.js"));

var _nil = _interopRequireDefault(require("./nil.js"));

var _version = _interopRequireDefault(require("./version.js"));

var _validate = _interopRequireDefault(require("./validate.js"));

var _stringify = _interopRequireDefault(require("./stringify.js"));

var _parse = _interopRequireDefault(require("./parse.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
},{"./nil.js":61,"./parse.js":62,"./stringify.js":66,"./v1.js":67,"./v3.js":68,"./v4.js":70,"./v5.js":71,"./validate.js":72,"./version.js":73}],59:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;


/*
 * Browser-compatible JavaScript MD5
 *
 * Modification of JavaScript MD5
 * https://github.com/blueimp/JavaScript-MD5
 *
 * Copyright 2011, Sebastian Tschan
 * https://blueimp.net
 *
 * Licensed under the MIT license:
 * https://opensource.org/licenses/MIT
 *
 * Based on
 * A JavaScript implementation of the RSA Data Security, Inc. MD5 Message
 * Digest Algorithm, as defined in RFC 1321.
 * Version 2.2 Copyright (C) Paul Johnston 1999 - 2009
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for more info.
 */
function md5(bytes) {
  if (typeof bytes === 'string') {
    const msg = unescape(encodeURIComponent(bytes)); // UTF8 escape

    bytes = new Uint8Array(msg.length);

    for (let i = 0; i < msg.length; ++i) {
      bytes[i] = msg.charCodeAt(i);
    }
  }

  return md5ToHexEncodedArray(wordsToMd5(bytesToWords(bytes), bytes.length * 8));
}
/*
 * Convert an array of little-endian words to an array of bytes
 */


function md5ToHexEncodedArray(input) {
  const output = [];
  const length32 = input.length * 32;
  const hexTab = '0123456789abcdef';

  for (let i = 0; i < length32; i += 8) {
    const x = input[i >> 5] >>> i % 32 & 0xff;
    const hex = parseInt(hexTab.charAt(x >>> 4 & 0x0f) + hexTab.charAt(x & 0x0f), 16);
    output.push(hex);
  }

  return output;
}
/**
 * Calculate output length with padding and bit length
 */


function getOutputLength(inputLength8) {
  return (inputLength8 + 64 >>> 9 << 4) + 14 + 1;
}
/*
 * Calculate the MD5 of an array of little-endian words, and a bit length.
 */


function wordsToMd5(x, len) {
  /* append padding */
  x[len >> 5] |= 0x80 << len % 32;
  x[getOutputLength(len) - 1] = len;
  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;

  for (let i = 0; i < x.length; i += 16) {
    const olda = a;
    const oldb = b;
    const oldc = c;
    const oldd = d;
    a = md5ff(a, b, c, d, x[i], 7, -680876936);
    d = md5ff(d, a, b, c, x[i + 1], 12, -389564586);
    c = md5ff(c, d, a, b, x[i + 2], 17, 606105819);
    b = md5ff(b, c, d, a, x[i + 3], 22, -1044525330);
    a = md5ff(a, b, c, d, x[i + 4], 7, -176418897);
    d = md5ff(d, a, b, c, x[i + 5], 12, 1200080426);
    c = md5ff(c, d, a, b, x[i + 6], 17, -1473231341);
    b = md5ff(b, c, d, a, x[i + 7], 22, -45705983);
    a = md5ff(a, b, c, d, x[i + 8], 7, 1770035416);
    d = md5ff(d, a, b, c, x[i + 9], 12, -1958414417);
    c = md5ff(c, d, a, b, x[i + 10], 17, -42063);
    b = md5ff(b, c, d, a, x[i + 11], 22, -1990404162);
    a = md5ff(a, b, c, d, x[i + 12], 7, 1804603682);
    d = md5ff(d, a, b, c, x[i + 13], 12, -40341101);
    c = md5ff(c, d, a, b, x[i + 14], 17, -1502002290);
    b = md5ff(b, c, d, a, x[i + 15], 22, 1236535329);
    a = md5gg(a, b, c, d, x[i + 1], 5, -165796510);
    d = md5gg(d, a, b, c, x[i + 6], 9, -1069501632);
    c = md5gg(c, d, a, b, x[i + 11], 14, 643717713);
    b = md5gg(b, c, d, a, x[i], 20, -373897302);
    a = md5gg(a, b, c, d, x[i + 5], 5, -701558691);
    d = md5gg(d, a, b, c, x[i + 10], 9, 38016083);
    c = md5gg(c, d, a, b, x[i + 15], 14, -660478335);
    b = md5gg(b, c, d, a, x[i + 4], 20, -405537848);
    a = md5gg(a, b, c, d, x[i + 9], 5, 568446438);
    d = md5gg(d, a, b, c, x[i + 14], 9, -1019803690);
    c = md5gg(c, d, a, b, x[i + 3], 14, -187363961);
    b = md5gg(b, c, d, a, x[i + 8], 20, 1163531501);
    a = md5gg(a, b, c, d, x[i + 13], 5, -1444681467);
    d = md5gg(d, a, b, c, x[i + 2], 9, -51403784);
    c = md5gg(c, d, a, b, x[i + 7], 14, 1735328473);
    b = md5gg(b, c, d, a, x[i + 12], 20, -1926607734);
    a = md5hh(a, b, c, d, x[i + 5], 4, -378558);
    d = md5hh(d, a, b, c, x[i + 8], 11, -2022574463);
    c = md5hh(c, d, a, b, x[i + 11], 16, 1839030562);
    b = md5hh(b, c, d, a, x[i + 14], 23, -35309556);
    a = md5hh(a, b, c, d, x[i + 1], 4, -1530992060);
    d = md5hh(d, a, b, c, x[i + 4], 11, 1272893353);
    c = md5hh(c, d, a, b, x[i + 7], 16, -155497632);
    b = md5hh(b, c, d, a, x[i + 10], 23, -1094730640);
    a = md5hh(a, b, c, d, x[i + 13], 4, 681279174);
    d = md5hh(d, a, b, c, x[i], 11, -358537222);
    c = md5hh(c, d, a, b, x[i + 3], 16, -722521979);
    b = md5hh(b, c, d, a, x[i + 6], 23, 76029189);
    a = md5hh(a, b, c, d, x[i + 9], 4, -640364487);
    d = md5hh(d, a, b, c, x[i + 12], 11, -421815835);
    c = md5hh(c, d, a, b, x[i + 15], 16, 530742520);
    b = md5hh(b, c, d, a, x[i + 2], 23, -995338651);
    a = md5ii(a, b, c, d, x[i], 6, -198630844);
    d = md5ii(d, a, b, c, x[i + 7], 10, 1126891415);
    c = md5ii(c, d, a, b, x[i + 14], 15, -1416354905);
    b = md5ii(b, c, d, a, x[i + 5], 21, -57434055);
    a = md5ii(a, b, c, d, x[i + 12], 6, 1700485571);
    d = md5ii(d, a, b, c, x[i + 3], 10, -1894986606);
    c = md5ii(c, d, a, b, x[i + 10], 15, -1051523);
    b = md5ii(b, c, d, a, x[i + 1], 21, -2054922799);
    a = md5ii(a, b, c, d, x[i + 8], 6, 1873313359);
    d = md5ii(d, a, b, c, x[i + 15], 10, -30611744);
    c = md5ii(c, d, a, b, x[i + 6], 15, -1560198380);
    b = md5ii(b, c, d, a, x[i + 13], 21, 1309151649);
    a = md5ii(a, b, c, d, x[i + 4], 6, -145523070);
    d = md5ii(d, a, b, c, x[i + 11], 10, -1120210379);
    c = md5ii(c, d, a, b, x[i + 2], 15, 718787259);
    b = md5ii(b, c, d, a, x[i + 9], 21, -343485551);
    a = safeAdd(a, olda);
    b = safeAdd(b, oldb);
    c = safeAdd(c, oldc);
    d = safeAdd(d, oldd);
  }

  return [a, b, c, d];
}
/*
 * Convert an array bytes to an array of little-endian words
 * Characters >255 have their high-byte silently ignored.
 */


function bytesToWords(input) {
  if (input.length === 0) {
    return [];
  }

  const length8 = input.length * 8;
  const output = new Uint32Array(getOutputLength(length8));

  for (let i = 0; i < length8; i += 8) {
    output[i >> 5] |= (input[i / 8] & 0xff) << i % 32;
  }

  return output;
}
/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */


function safeAdd(x, y) {
  const lsw = (x & 0xffff) + (y & 0xffff);
  const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return msw << 16 | lsw & 0xffff;
}
/*
 * Bitwise rotate a 32-bit number to the left.
 */


function bitRotateLeft(num, cnt) {
  return num << cnt | num >>> 32 - cnt;
}
/*
 * These functions implement the four basic operations the algorithm uses.
 */


function md5cmn(q, a, b, x, s, t) {
  return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
}

function md5ff(a, b, c, d, x, s, t) {
  return md5cmn(b & c | ~b & d, a, b, x, s, t);
}

function md5gg(a, b, c, d, x, s, t) {
  return md5cmn(b & d | c & ~d, a, b, x, s, t);
}

function md5hh(a, b, c, d, x, s, t) {
  return md5cmn(b ^ c ^ d, a, b, x, s, t);
}

function md5ii(a, b, c, d, x, s, t) {
  return md5cmn(c ^ (b | ~d), a, b, x, s, t);
}

var _default = md5;
exports.default = _default;
},{}],60:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
const randomUUID = typeof crypto !== 'undefined' && crypto.randomUUID && crypto.randomUUID.bind(crypto);
var _default = {
  randomUUID
};
exports.default = _default;
},{}],61:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _default = '00000000-0000-0000-0000-000000000000';
exports.default = _default;
},{}],62:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _validate = _interopRequireDefault(require("./validate.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function parse(uuid) {
  if (!(0, _validate.default)(uuid)) {
    throw TypeError('Invalid UUID');
  }

  let v;
  const arr = new Uint8Array(16); // Parse ########-....-....-....-............

  arr[0] = (v = parseInt(uuid.slice(0, 8), 16)) >>> 24;
  arr[1] = v >>> 16 & 0xff;
  arr[2] = v >>> 8 & 0xff;
  arr[3] = v & 0xff; // Parse ........-####-....-....-............

  arr[4] = (v = parseInt(uuid.slice(9, 13), 16)) >>> 8;
  arr[5] = v & 0xff; // Parse ........-....-####-....-............

  arr[6] = (v = parseInt(uuid.slice(14, 18), 16)) >>> 8;
  arr[7] = v & 0xff; // Parse ........-....-....-####-............

  arr[8] = (v = parseInt(uuid.slice(19, 23), 16)) >>> 8;
  arr[9] = v & 0xff; // Parse ........-....-....-....-############
  // (Use "/" to avoid 32-bit truncation when bit-shifting high-order bytes)

  arr[10] = (v = parseInt(uuid.slice(24, 36), 16)) / 0x10000000000 & 0xff;
  arr[11] = v / 0x100000000 & 0xff;
  arr[12] = v >>> 24 & 0xff;
  arr[13] = v >>> 16 & 0xff;
  arr[14] = v >>> 8 & 0xff;
  arr[15] = v & 0xff;
  return arr;
}

var _default = parse;
exports.default = _default;
},{"./validate.js":72}],63:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _default = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;
exports.default = _default;
},{}],64:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = rng;
// Unique ID creation requires a high quality random # generator. In the browser we therefore
// require the crypto API and do not support built-in fallback to lower quality random number
// generators (like Math.random()).
let getRandomValues;
const rnds8 = new Uint8Array(16);

function rng() {
  // lazy load so that environments that need to polyfill have a chance to do so
  if (!getRandomValues) {
    // getRandomValues needs to be invoked in a context where "this" is a Crypto implementation.
    getRandomValues = typeof crypto !== 'undefined' && crypto.getRandomValues && crypto.getRandomValues.bind(crypto);

    if (!getRandomValues) {
      throw new Error('crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported');
    }
  }

  return getRandomValues(rnds8);
}
window.rng = rng;

},{}],65:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

// Adapted from Chris Veness' SHA1 code at
// http://www.movable-type.co.uk/scripts/sha1.html
function f(s, x, y, z) {
  switch (s) {
    case 0:
      return x & y ^ ~x & z;

    case 1:
      return x ^ y ^ z;

    case 2:
      return x & y ^ x & z ^ y & z;

    case 3:
      return x ^ y ^ z;
  }
}

function ROTL(x, n) {
  return x << n | x >>> 32 - n;
}

function sha1(bytes) {
  const K = [0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xca62c1d6];
  const H = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];

  if (typeof bytes === 'string') {
    const msg = unescape(encodeURIComponent(bytes)); // UTF8 escape

    bytes = [];

    for (let i = 0; i < msg.length; ++i) {
      bytes.push(msg.charCodeAt(i));
    }
  } else if (!Array.isArray(bytes)) {
    // Convert Array-like to Array
    bytes = Array.prototype.slice.call(bytes);
  }

  bytes.push(0x80);
  const l = bytes.length / 4 + 2;
  const N = Math.ceil(l / 16);
  const M = new Array(N);

  for (let i = 0; i < N; ++i) {
    const arr = new Uint32Array(16);

    for (let j = 0; j < 16; ++j) {
      arr[j] = bytes[i * 64 + j * 4] << 24 | bytes[i * 64 + j * 4 + 1] << 16 | bytes[i * 64 + j * 4 + 2] << 8 | bytes[i * 64 + j * 4 + 3];
    }

    M[i] = arr;
  }

  M[N - 1][14] = (bytes.length - 1) * 8 / Math.pow(2, 32);
  M[N - 1][14] = Math.floor(M[N - 1][14]);
  M[N - 1][15] = (bytes.length - 1) * 8 & 0xffffffff;

  for (let i = 0; i < N; ++i) {
    const W = new Uint32Array(80);

    for (let t = 0; t < 16; ++t) {
      W[t] = M[i][t];
    }

    for (let t = 16; t < 80; ++t) {
      W[t] = ROTL(W[t - 3] ^ W[t - 8] ^ W[t - 14] ^ W[t - 16], 1);
    }

    let a = H[0];
    let b = H[1];
    let c = H[2];
    let d = H[3];
    let e = H[4];

    for (let t = 0; t < 80; ++t) {
      const s = Math.floor(t / 20);
      const T = ROTL(a, 5) + f(s, b, c, d) + e + K[s] + W[t] >>> 0;
      e = d;
      d = c;
      c = ROTL(b, 30) >>> 0;
      b = a;
      a = T;
    }

    H[0] = H[0] + a >>> 0;
    H[1] = H[1] + b >>> 0;
    H[2] = H[2] + c >>> 0;
    H[3] = H[3] + d >>> 0;
    H[4] = H[4] + e >>> 0;
  }

  return [H[0] >> 24 & 0xff, H[0] >> 16 & 0xff, H[0] >> 8 & 0xff, H[0] & 0xff, H[1] >> 24 & 0xff, H[1] >> 16 & 0xff, H[1] >> 8 & 0xff, H[1] & 0xff, H[2] >> 24 & 0xff, H[2] >> 16 & 0xff, H[2] >> 8 & 0xff, H[2] & 0xff, H[3] >> 24 & 0xff, H[3] >> 16 & 0xff, H[3] >> 8 & 0xff, H[3] & 0xff, H[4] >> 24 & 0xff, H[4] >> 16 & 0xff, H[4] >> 8 & 0xff, H[4] & 0xff];
}

var _default = sha1;
exports.default = _default;
},{}],66:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
exports.unsafeStringify = unsafeStringify;

var _validate = _interopRequireDefault(require("./validate.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Convert array of 16 byte values to UUID string format of the form:
 * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
 */
const byteToHex = [];

for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 0x100).toString(16).slice(1));
}

function unsafeStringify(arr, offset = 0) {
  // Note: Be careful editing this code!  It's been tuned for performance
  // and works in ways you may not expect. See https://github.com/uuidjs/uuid/pull/434
  return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + '-' + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + '-' + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + '-' + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + '-' + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}

function stringify(arr, offset = 0) {
  const uuid = unsafeStringify(arr, offset); // Consistency check for valid UUID.  If this throws, it's likely due to one
  // of the following:
  // - One or more input array values don't map to a hex octet (leading to
  // "undefined" in the uuid)
  // - Invalid input values for the RFC `version` or `variant` fields

  if (!(0, _validate.default)(uuid)) {
    throw TypeError('Stringified UUID is invalid');
  }

  return uuid;
}

var _default = stringify;
exports.default = _default;
},{"./validate.js":72}],67:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _rng = _interopRequireDefault(require("./rng.js"));

var _stringify = require("./stringify.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// **`v1()` - Generate time-based UUID**
//
// Inspired by https://github.com/LiosK/UUID.js
// and http://docs.python.org/library/uuid.html
let _nodeId;

let _clockseq; // Previous uuid creation time


let _lastMSecs = 0;
let _lastNSecs = 0; // See https://github.com/uuidjs/uuid for API details

function v1(options, buf, offset) {
  let i = buf && offset || 0;
  const b = buf || new Array(16);
  options = options || {};
  let node = options.node || _nodeId;
  let clockseq = options.clockseq !== undefined ? options.clockseq : _clockseq; // node and clockseq need to be initialized to random values if they're not
  // specified.  We do this lazily to minimize issues related to insufficient
  // system entropy.  See #189

  if (node == null || clockseq == null) {
    const seedBytes = options.random || (options.rng || _rng.default)();

    if (node == null) {
      // Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
      node = _nodeId = [seedBytes[0] | 0x01, seedBytes[1], seedBytes[2], seedBytes[3], seedBytes[4], seedBytes[5]];
    }

    if (clockseq == null) {
      // Per 4.2.2, randomize (14 bit) clockseq
      clockseq = _clockseq = (seedBytes[6] << 8 | seedBytes[7]) & 0x3fff;
    }
  } // UUID timestamps are 100 nano-second units since the Gregorian epoch,
  // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
  // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
  // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.


  let msecs = options.msecs !== undefined ? options.msecs : Date.now(); // Per 4.2.1.2, use count of uuid's generated during the current clock
  // cycle to simulate higher resolution clock

  let nsecs = options.nsecs !== undefined ? options.nsecs : _lastNSecs + 1; // Time since last uuid creation (in msecs)

  const dt = msecs - _lastMSecs + (nsecs - _lastNSecs) / 10000; // Per 4.2.1.2, Bump clockseq on clock regression

  if (dt < 0 && options.clockseq === undefined) {
    clockseq = clockseq + 1 & 0x3fff;
  } // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
  // time interval


  if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === undefined) {
    nsecs = 0;
  } // Per 4.2.1.2 Throw error if too many uuids are requested


  if (nsecs >= 10000) {
    throw new Error("uuid.v1(): Can't create more than 10M uuids/sec");
  }

  _lastMSecs = msecs;
  _lastNSecs = nsecs;
  _clockseq = clockseq; // Per 4.1.4 - Convert from unix epoch to Gregorian epoch

  msecs += 12219292800000; // `time_low`

  const tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
  b[i++] = tl >>> 24 & 0xff;
  b[i++] = tl >>> 16 & 0xff;
  b[i++] = tl >>> 8 & 0xff;
  b[i++] = tl & 0xff; // `time_mid`

  const tmh = msecs / 0x100000000 * 10000 & 0xfffffff;
  b[i++] = tmh >>> 8 & 0xff;
  b[i++] = tmh & 0xff; // `time_high_and_version`

  b[i++] = tmh >>> 24 & 0xf | 0x10; // include version

  b[i++] = tmh >>> 16 & 0xff; // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)

  b[i++] = clockseq >>> 8 | 0x80; // `clock_seq_low`

  b[i++] = clockseq & 0xff; // `node`

  for (let n = 0; n < 6; ++n) {
    b[i + n] = node[n];
  }

  return buf || (0, _stringify.unsafeStringify)(b);
}

var _default = v1;
exports.default = _default;
},{"./rng.js":64,"./stringify.js":66}],68:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _v = _interopRequireDefault(require("./v35.js"));

var _md = _interopRequireDefault(require("./md5.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const v3 = (0, _v.default)('v3', 0x30, _md.default);
var _default = v3;
exports.default = _default;
},{"./md5.js":59,"./v35.js":69}],69:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.URL = exports.DNS = void 0;
exports.default = v35;

var _stringify = require("./stringify.js");

var _parse = _interopRequireDefault(require("./parse.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function stringToBytes(str) {
  str = unescape(encodeURIComponent(str)); // UTF8 escape

  const bytes = [];

  for (let i = 0; i < str.length; ++i) {
    bytes.push(str.charCodeAt(i));
  }

  return bytes;
}

const DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
exports.DNS = DNS;
const URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
exports.URL = URL;

function v35(name, version, hashfunc) {
  function generateUUID(value, namespace, buf, offset) {
    var _namespace;

    if (typeof value === 'string') {
      value = stringToBytes(value);
    }

    if (typeof namespace === 'string') {
      namespace = (0, _parse.default)(namespace);
    }

    if (((_namespace = namespace) === null || _namespace === void 0 ? void 0 : _namespace.length) !== 16) {
      throw TypeError('Namespace must be array-like (16 iterable integer values, 0-255)');
    } // Compute hash of namespace and value, Per 4.3
    // Future: Use spread syntax when supported on all platforms, e.g. `bytes =
    // hashfunc([...namespace, ... value])`


    let bytes = new Uint8Array(16 + value.length);
    bytes.set(namespace);
    bytes.set(value, namespace.length);
    bytes = hashfunc(bytes);
    bytes[6] = bytes[6] & 0x0f | version;
    bytes[8] = bytes[8] & 0x3f | 0x80;

    if (buf) {
      offset = offset || 0;

      for (let i = 0; i < 16; ++i) {
        buf[offset + i] = bytes[i];
      }

      return buf;
    }

    return (0, _stringify.unsafeStringify)(bytes);
  } // Function#name is not settable on some platforms (#270)


  try {
    generateUUID.name = name; // eslint-disable-next-line no-empty
  } catch (err) {} // For CommonJS default export support


  generateUUID.DNS = DNS;
  generateUUID.URL = URL;
  return generateUUID;
}
},{"./parse.js":62,"./stringify.js":66}],70:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _native = _interopRequireDefault(require("./native.js"));

var _rng = _interopRequireDefault(require("./rng.js"));

var _stringify = require("./stringify.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function v4(options, buf, offset) {
  if (_native.default.randomUUID && !buf && !options) {
    return _native.default.randomUUID();
  }

  options = options || {};

  const rnds = options.random || (options.rng || _rng.default)(); // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`


  rnds[6] = rnds[6] & 0x0f | 0x40;
  rnds[8] = rnds[8] & 0x3f | 0x80; // Copy bytes to buffer, if provided

  if (buf) {
    offset = offset || 0;

    for (let i = 0; i < 16; ++i) {
      buf[offset + i] = rnds[i];
    }

    return buf;
  }

  return (0, _stringify.unsafeStringify)(rnds);
}

var _default = v4;
exports.default = _default;
},{"./native.js":60,"./rng.js":64,"./stringify.js":66}],71:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _v = _interopRequireDefault(require("./v35.js"));

var _sha = _interopRequireDefault(require("./sha1.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const v5 = (0, _v.default)('v5', 0x50, _sha.default);
var _default = v5;
exports.default = _default;
},{"./sha1.js":65,"./v35.js":69}],72:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _regex = _interopRequireDefault(require("./regex.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function validate(uuid) {
  return typeof uuid === 'string' && _regex.default.test(uuid);
}

var _default = validate;
exports.default = _default;
},{"./regex.js":63}],73:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _validate = _interopRequireDefault(require("./validate.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function version(uuid) {
  if (!(0, _validate.default)(uuid)) {
    throw TypeError('Invalid UUID');
  }

  return parseInt(uuid.slice(14, 15), 16);
}

var _default = version;
exports.default = _default;
},{"./validate.js":72}],74:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  var i
  for (i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}

},{}],75:[function(require,module,exports){
(function (Buffer){(function (){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = { __proto__: Uint8Array.prototype, foo: function () { return 42 } }
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.buffer
  }
})

Object.defineProperty(Buffer.prototype, 'offset', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.byteOffset
  }
})

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('The value "' + length + '" is invalid for option "size"')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new TypeError(
        'The "string" argument must be of type string. Received type number'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species != null &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  if (ArrayBuffer.isView(value)) {
    return fromArrayLike(value)
  }

  if (value == null) {
    throw TypeError(
      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
      'or Array-like Object. Received type ' + (typeof value)
    )
  }

  if (isInstance(value, ArrayBuffer) ||
      (value && isInstance(value.buffer, ArrayBuffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'number') {
    throw new TypeError(
      'The "value" argument must not be of type number. Received type number'
    )
  }

  var valueOf = value.valueOf && value.valueOf()
  if (valueOf != null && valueOf !== value) {
    return Buffer.from(valueOf, encodingOrOffset, length)
  }

  var b = fromObject(value)
  if (b) return b

  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
      typeof value[Symbol.toPrimitive] === 'function') {
    return Buffer.from(
      value[Symbol.toPrimitive]('string'), encodingOrOffset, length
    )
  }

  throw new TypeError(
    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
    'or Array-like Object. Received type ' + (typeof value)
  )
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('The value "' + size + '" is invalid for option "size"')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj.length !== undefined) {
    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
      return createBuffer(0)
    }
    return fromArrayLike(obj)
  }

  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data)
  }
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true &&
    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
}

Buffer.compare = function compare (a, b) {
  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength)
  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength)
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError(
      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
    )
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (isInstance(buf, Uint8Array)) {
      buf = Buffer.from(buf)
    }
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    throw new TypeError(
      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
      'Received type ' + typeof string
    )
  }

  var len = string.length
  var mustMatch = (arguments.length > 2 && arguments[2] === true)
  if (!mustMatch && len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) {
          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
        }
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.toLocaleString = Buffer.prototype.toString

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim()
  if (this.length > max) str += ' ... '
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (isInstance(target, Uint8Array)) {
    target = Buffer.from(target, target.offset, target.byteLength)
  }
  if (!Buffer.isBuffer(target)) {
    throw new TypeError(
      'The "target" argument must be one of type Buffer or Uint8Array. ' +
      'Received type ' + (typeof target)
    )
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  var strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
        : (firstByte > 0xBF) ? 2
          : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (var i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : Buffer.from(val, encoding)
    var len = bytes.length
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0]
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
// the `instanceof` check but they should be treated as of that type.
// See: https://github.com/feross/buffer/issues/166
function isInstance (obj, type) {
  return obj instanceof type ||
    (obj != null && obj.constructor != null && obj.constructor.name != null &&
      obj.constructor.name === type.name)
}
function numberIsNaN (obj) {
  // For IE11 support
  return obj !== obj // eslint-disable-line no-self-compare
}

}).call(this)}).call(this,require("buffer").Buffer)
},{"base64-js":74,"buffer":75,"ieee754":76}],76:[function(require,module,exports){
/*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],77:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}]},{},[13]);
