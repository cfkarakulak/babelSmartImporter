"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports["default"] = dir;
var _template = _interopRequireDefault(require("@babel/template"));
var _path2 = _interopRequireDefault(require("path"));
var _fs2 = _interopRequireDefault(require("fs"));

function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
        "default": obj
    }
}

function _toConsumableArray(arr) {
    return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread()
}

function _nonIterableSpread() {
    throw new TypeError("Invalid attempt to spread non-iterable instance")
}

function _iterableToArray(iter) {
    if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter)
}

function _arrayWithoutHoles(arr) {
    if (Array.isArray(arr)) {
        for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) {
            arr2[i] = arr[i]
        }
        return arr2
    }
}

function _slicedToArray(arr, i) {
    return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest()
}

function _nonIterableRest() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance")
}

function _iterableToArrayLimit(arr, i) {
    var _arr = [];
    var _n = true;
    var _d = false;
    var _e = undefined;
    try {
        for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
            _arr.push(_s.value);
            if (i && _arr.length === i) break
        }
    } catch (err) {
        _d = true;
        _e = err
    } finally {
        try {
            if (!_n && _i["return"] != null) _i["return"]()
        } finally {
            if (_d) throw _e
        }
    }
    return _arr
}

function _arrayWithHoles(arr) {
    if (Array.isArray(arr)) return arr
}
var wildcardRegex = /\/\*$/;
var recursiveRegex = /\/\*\*$/;
var buildRequire = (0, _template["default"])("for (let key in IMPORTED) {\n  DIR_IMPORT[key === 'default' ? IMPORTED_NAME : key] = IMPORTED[key]\n}");
var toSomeStupidCase = function toSomeStupidCase(path, names) {
  path = path.charAt(0).toUpperCase() + path.slice(1);
  names = names.map(function(x){
    return x.charAt(0).toUpperCase() + x.slice(1);
  });

  return path + names.join('');
};
var toSnakeCase = function toSnakeCase(names) {
    return name.replace(/([-.A-Z])/g, function(_, $1) {
        return "_" + ($1 === "." || $1 === "-" ? "" : $1.toLowerCase())
    })
};
var getFiles = function getFiles(parent) {
    var exts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [".js", ".es6", ".es", ".jsx"];
    var files = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
    var recursive = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
    var path = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : [];
    var r = _fs2["default"].readdirSync(parent);

    for (var i = 0, l = r.length; i < l; i++) {
        var child = r[i];
        var _path$parse = _path2["default"].parse(child),
            name = _path$parse.name,
            ext = _path$parse.ext;
        var file = path.concat(name); // Check extension is of one of the aboves
        if (exts.includes(ext)) {
            files.push(file)
        } else if (recursive && _fs2["default"].statSync(_path2["default"].join(parent, child)).isDirectory()) {
            getFiles(_path2["default"].join(parent, name), exts, files, recursive, file)
        }
    }
    return files
};

function dir(babel) {
    var t = babel.types;
    return {
        visitor: {
            ImportDeclaration: function ImportDeclaration(path, state) {
                var node = path.node;
                var src = node.source.value;
                if (src[0] !== "." && src[0] !== "/") {
                    return
                }
                var pathPrefix = src.split("/")[0] + "/";
                var isExplicitWildcard = wildcardRegex.test(src);
                var cleanedPath = src.replace(wildcardRegex, "");
                var isRecursive = recursiveRegex.test(cleanedPath);
                cleanedPath = cleanedPath.replace(recursiveRegex, "");
                var sourcePath = this.file.opts.parserOpts.sourceFileName || this.file.opts.parserOpts.filename || "";
                var checkPath = _path2["default"].resolve(_path2["default"].join(_path2["default"].dirname(sourcePath), cleanedPath));
                try {
                    require.resolve(checkPath);
                    return
                } catch (e) {}
                try {
                    if (!_fs2["default"].statSync(checkPath).isDirectory()) {
                        return
                    }
                } catch (e) {
                    return
                }
                var nameTransform = toSomeStupidCase;
                var _files = getFiles(checkPath, state.opts.exts, [], isRecursive);
                var files = _files.map(function(file) {
                    return [file, nameTransform(checkPath.split('/').pop(), file), path.scope.generateUidIdentifier(file[file.length - 1])]
                });
                if (!files.length) {
                    return
                }
                var imports = files.map(function(_ref) {
                    var _ref2 = _slicedToArray(_ref, 3),
                        file = _ref2[0],
                        fileName = _ref2[1],
                        fileUid = _ref2[2];
                    return t.importDeclaration([t.importNamespaceSpecifier(fileUid)], t.stringLiteral(pathPrefix + _path2["default"].join.apply(_path2["default"], [cleanedPath].concat(_toConsumableArray(file)))))
                });
                var dirVar = path.scope.generateUidIdentifier("dirImport");
                path.insertBefore(t.variableDeclaration("const", [t.variableDeclarator(dirVar, t.objectExpression([]))]));
                for (var i = node.specifiers.length - 1; i >= 0; i--) {
                    var dec = node.specifiers[i];
                    if (t.isImportNamespaceSpecifier(dec) || t.isImportDefaultSpecifier(dec)) {
                        path.insertAfter(t.variableDeclaration("const", [t.variableDeclarator(t.identifier(dec.local.name), dirVar)]))
                    }
                    if (t.isImportSpecifier(dec)) {
                        path.insertAfter(t.variableDeclaration("const", [t.variableDeclarator(t.identifier(dec.local.name), t.memberExpression(dirVar, t.identifier(dec.imported.name)))]))
                    }
                }
                if (isExplicitWildcard) {
                    files.forEach(function(_ref3) {
                        var _ref4 = _slicedToArray(_ref3, 3),
                            file = _ref4[0],
                            fileName = _ref4[1],
                            fileUid = _ref4[2];
                        return path.insertAfter(buildRequire({
                            IMPORTED_NAME: t.stringLiteral(fileName),
                            DIR_IMPORT: dirVar,
                            IMPORTED: fileUid
                        }))
                    })
                } else {
                    files.forEach(function(_ref5) {
                        var _ref6 = _slicedToArray(_ref5, 3),
                            file = _ref6[0],
                            fileName = _ref6[1],
                            fileUid = _ref6[2];
                        return path.insertAfter(t.assignmentExpression("=", t.memberExpression(dirVar, t.identifier(fileName)), fileUid))
                    })
                }
                path.replaceWithMultiple(imports)
            }
        }
    }
}
