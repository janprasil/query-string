"use strict";

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var decodeComponent = require("decode-uri-component");

function splitOnFirst(string, separator) {
	if (!(typeof string === "string" && typeof separator === "string")) {
		throw new TypeError("Expected the arguments to be of type `string`");
	}

	if (separator === "") {
		return [string];
	}

	var separatorIndex = string.indexOf(separator);

	if (separatorIndex === -1) {
		return [string];
	}

	return [string.slice(0, separatorIndex), string.slice(separatorIndex + separator.length)];
}

function strictUriEncode(str) {
	return encodeURIComponent(str).replace(/[!'()*]/g, function (x) {
		return "%" + x.charCodeAt(0).toString(16).toUpperCase();
	});
}

function encoderForArrayFormat(options) {
	switch (options.arrayFormat) {
		case "index":
			return function (key) {
				return function (result, value) {
					var index = result.length;
					if (value === undefined || options.skipNull && value === null) {
						return result;
					}

					if (value === null) {
						return [].concat(_toConsumableArray(result), [[encode(key, options), "[", index, "]"].join("")]);
					}

					return [].concat(_toConsumableArray(result), [[encode(key, options), "[", encode(index, options), "]=", encode(value, options)].join("")]);
				};
			};

		case "bracket":
			return function (key) {
				return function (result, value) {
					if (value === undefined || options.skipNull && value === null) {
						return result;
					}

					if (value === null) {
						return [].concat(_toConsumableArray(result), [[encode(key, options), "[]"].join("")]);
					}

					return [].concat(_toConsumableArray(result), [[encode(key, options), "[]=", encode(value, options)].join("")]);
				};
			};

		case "comma":
			return function (key) {
				return function (result, value) {
					if (value === null || value === undefined || value.length === 0) {
						return result;
					}

					if (result.length === 0) {
						return [[encode(key, options), "=", encode(value, options)].join("")];
					}

					return [[result, encode(value, options)].join(",")];
				};
			};

		default:
			return function (key) {
				return function (result, value) {
					if (value === undefined || options.skipNull && value === null) {
						return result;
					}

					if (value === null) {
						return [].concat(_toConsumableArray(result), [encode(key, options)]);
					}

					return [].concat(_toConsumableArray(result), [[encode(key, options), "=", encode(value, options)].join("")]);
				};
			};
	}
}

function parserForArrayFormat(options) {
	var result = void 0;

	switch (options.arrayFormat) {
		case "index":
			return function (key, value, accumulator) {
				result = /\[(\d*)\]$/.exec(key);

				key = key.replace(/\[\d*\]$/, "");

				if (!result) {
					accumulator[key] = value;
					return;
				}

				if (accumulator[key] === undefined) {
					accumulator[key] = {};
				}

				accumulator[key][result[1]] = value;
			};

		case "bracket":
			return function (key, value, accumulator) {
				result = /(\[\])$/.exec(key);
				key = key.replace(/\[\]$/, "");

				if (!result) {
					accumulator[key] = value;
					return;
				}

				if (accumulator[key] === undefined) {
					accumulator[key] = [value];
					return;
				}

				accumulator[key] = [].concat(accumulator[key], value);
			};

		case "comma":
			return function (key, value, accumulator) {
				var isArray = typeof value === "string" && value.split("").indexOf(",") > -1;
				var newValue = isArray ? value.split(",") : value;
				accumulator[key] = newValue;
			};

		default:
			return function (key, value, accumulator) {
				if (accumulator[key] === undefined) {
					accumulator[key] = value;
					return;
				}

				accumulator[key] = [].concat(accumulator[key], value);
			};
	}
}

function encode(value, options) {
	if (options.encode) {
		return options.strict ? strictUriEncode(value) : encodeURIComponent(value);
	}

	return value;
}

function decode(value, options) {
	if (options.decode) {
		return decodeComponent(value);
	}

	return value;
}

function keysSorter(input) {
	if (Array.isArray(input)) {
		return input.sort();
	}

	if ((typeof input === "undefined" ? "undefined" : _typeof(input)) === "object") {
		return keysSorter(Object.keys(input)).sort(function (a, b) {
			return Number(a) - Number(b);
		}).map(function (key) {
			return input[key];
		});
	}

	return input;
}

function removeHash(input) {
	var hashStart = input.indexOf("#");
	if (hashStart !== -1) {
		input = input.slice(0, hashStart);
	}

	return input;
}

function extract(input) {
	input = removeHash(input);
	var queryStart = input.indexOf("?");
	if (queryStart === -1) {
		return "";
	}

	return input.slice(queryStart + 1);
}

function parseValue(value, options) {
	if (options.parseNumbers && !Number.isNaN(Number(value)) && typeof value === "string" && value.trim() !== "") {
		value = Number(value);
	} else if (options.parseBooleans && value !== null && (value.toLowerCase() === "true" || value.toLowerCase() === "false")) {
		value = value.toLowerCase() === "true";
	}

	return value;
}

function parse(input, options) {
	options = Object.assign({
		decode: true,
		sort: true,
		arrayFormat: "none",
		parseNumbers: false,
		parseBooleans: false
	}, options);

	var formatter = parserForArrayFormat(options);

	// Create an object with no prototype
	var ret = Object.create(null);

	if (typeof input !== "string") {
		return ret;
	}

	input = input.trim().replace(/^[?#&]/, "");

	if (!input) {
		return ret;
	}

	var _iteratorNormalCompletion = true;
	var _didIteratorError = false;
	var _iteratorError = undefined;

	try {
		for (var _iterator = input.split("&")[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
			var param = _step.value;

			var _splitOnFirst = splitOnFirst(options.decode ? param.replace(/\+/g, " ") : param, "="),
			    _splitOnFirst2 = _slicedToArray(_splitOnFirst, 2),
			    key = _splitOnFirst2[0],
			    value = _splitOnFirst2[1];

			// Missing `=` should be `null`:
			// http://w3.org/TR/2012/WD-url-20120524/#collect-url-parameters


			value = value === undefined ? null : decode(value, options);
			formatter(decode(key, options), value, ret);
		}
	} catch (err) {
		_didIteratorError = true;
		_iteratorError = err;
	} finally {
		try {
			if (!_iteratorNormalCompletion && _iterator.return) {
				_iterator.return();
			}
		} finally {
			if (_didIteratorError) {
				throw _iteratorError;
			}
		}
	}

	var _iteratorNormalCompletion2 = true;
	var _didIteratorError2 = false;
	var _iteratorError2 = undefined;

	try {
		for (var _iterator2 = Object.keys(ret)[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
			var key = _step2.value;

			var value = ret[key];
			if ((typeof value === "undefined" ? "undefined" : _typeof(value)) === "object" && value !== null) {
				var _iteratorNormalCompletion3 = true;
				var _didIteratorError3 = false;
				var _iteratorError3 = undefined;

				try {
					for (var _iterator3 = Object.keys(value)[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
						var k = _step3.value;

						value[k] = parseValue(value[k], options);
					}
				} catch (err) {
					_didIteratorError3 = true;
					_iteratorError3 = err;
				} finally {
					try {
						if (!_iteratorNormalCompletion3 && _iterator3.return) {
							_iterator3.return();
						}
					} finally {
						if (_didIteratorError3) {
							throw _iteratorError3;
						}
					}
				}
			} else {
				ret[key] = parseValue(value, options);
			}
		}
	} catch (err) {
		_didIteratorError2 = true;
		_iteratorError2 = err;
	} finally {
		try {
			if (!_iteratorNormalCompletion2 && _iterator2.return) {
				_iterator2.return();
			}
		} finally {
			if (_didIteratorError2) {
				throw _iteratorError2;
			}
		}
	}

	if (options.sort === false) {
		return ret;
	}

	return (options.sort === true ? Object.keys(ret).sort() : Object.keys(ret).sort(options.sort)).reduce(function (result, key) {
		var value = ret[key];
		if (Boolean(value) && (typeof value === "undefined" ? "undefined" : _typeof(value)) === "object" && !Array.isArray(value)) {
			// Sort object keys, not values
			result[key] = keysSorter(value);
		} else {
			result[key] = value;
		}

		return result;
	}, Object.create(null));
}

exports.extract = extract;
exports.parse = parse;

exports.stringify = function (object, options) {
	if (!object) {
		return "";
	}

	options = Object.assign({
		encode: true,
		strict: true,
		arrayFormat: "none"
	}, options);

	var formatter = encoderForArrayFormat(options);

	var objectCopy = Object.assign({}, object);
	if (options.skipNull) {
		var _iteratorNormalCompletion4 = true;
		var _didIteratorError4 = false;
		var _iteratorError4 = undefined;

		try {
			for (var _iterator4 = Object.keys(objectCopy)[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
				var key = _step4.value;

				if (objectCopy[key] === undefined || objectCopy[key] === null) {
					delete objectCopy[key];
				}
			}
		} catch (err) {
			_didIteratorError4 = true;
			_iteratorError4 = err;
		} finally {
			try {
				if (!_iteratorNormalCompletion4 && _iterator4.return) {
					_iterator4.return();
				}
			} finally {
				if (_didIteratorError4) {
					throw _iteratorError4;
				}
			}
		}
	}

	var keys = Object.keys(objectCopy);

	if (options.sort !== false) {
		keys.sort(options.sort);
	}

	return keys.map(function (key) {
		var value = object[key];

		if (value === undefined) {
			return "";
		}

		if (value === null) {
			return encode(key, options);
		}

		if (Array.isArray(value)) {
			return value.reduce(formatter(key), []).join("&");
		}

		return encode(key, options) + "=" + encode(value, options);
	}).filter(function (x) {
		return x.length > 0;
	}).join("&");
};

exports.parseUrl = function (input, options) {
	return {
		url: removeHash(input).split("?")[0] || "",
		query: parse(extract(input), options)
	};
};