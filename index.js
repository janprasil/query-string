"use strict";
const decodeComponent = require("decode-uri-component");

function splitOnFirst(string, separator) {
	if (!(typeof string === "string" && typeof separator === "string")) {
		throw new TypeError("Expected the arguments to be of type `string`");
	}

	if (separator === "") {
		return [string];
	}

	const separatorIndex = string.indexOf(separator);

	if (separatorIndex === -1) {
		return [string];
	}

	return [
		string.slice(0, separatorIndex),
		string.slice(separatorIndex + separator.length)
	];
}

function strictUriEncode(str) {
	return encodeURIComponent(str).replace(
		/[!'()*]/g,
		x =>
			`%${x
				.charCodeAt(0)
				.toString(16)
				.toUpperCase()}`
	);
}

function encoderForArrayFormat(options) {
	switch (options.arrayFormat) {
		case "index":
			return key => (result, value) => {
				const index = result.length;
				if (value === undefined || (options.skipNull && value === null)) {
					return result;
				}

				if (value === null) {
					return [...result, [encode(key, options), "[", index, "]"].join("")];
				}

				return [
					...result,
					[
						encode(key, options),
						"[",
						encode(index, options),
						"]=",
						encode(value, options)
					].join("")
				];
			};

		case "bracket":
			return key => (result, value) => {
				if (value === undefined || (options.skipNull && value === null)) {
					return result;
				}

				if (value === null) {
					return [...result, [encode(key, options), "[]"].join("")];
				}

				return [
					...result,
					[encode(key, options), "[]=", encode(value, options)].join("")
				];
			};

		case "comma":
			return key => (result, value) => {
				if (value === null || value === undefined || value.length === 0) {
					return result;
				}

				if (result.length === 0) {
					return [[encode(key, options), "=", encode(value, options)].join("")];
				}

				return [[result, encode(value, options)].join(",")];
			};

		default:
			return key => (result, value) => {
				if (value === undefined || (options.skipNull && value === null)) {
					return result;
				}

				if (value === null) {
					return [...result, encode(key, options)];
				}

				return [
					...result,
					[encode(key, options), "=", encode(value, options)].join("")
				];
			};
	}
}

function parserForArrayFormat(options) {
	let result;

	switch (options.arrayFormat) {
		case "index":
			return (key, value, accumulator) => {
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
			return (key, value, accumulator) => {
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
			return (key, value, accumulator) => {
				const isArray =
					typeof value === "string" && value.split("").indexOf(",") > -1;
				const newValue = isArray ? value.split(",") : value;
				accumulator[key] = newValue;
			};

		default:
			return (key, value, accumulator) => {
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

	if (typeof input === "object") {
		return keysSorter(Object.keys(input))
			.sort((a, b) => Number(a) - Number(b))
			.map(key => input[key]);
	}

	return input;
}

function removeHash(input) {
	const hashStart = input.indexOf("#");
	if (hashStart !== -1) {
		input = input.slice(0, hashStart);
	}

	return input;
}

function extract(input) {
	input = removeHash(input);
	const queryStart = input.indexOf("?");
	if (queryStart === -1) {
		return "";
	}

	return input.slice(queryStart + 1);
}

function parseValue(value, options) {
	if (
		options.parseNumbers &&
		!Number.isNaN(Number(value)) &&
		typeof value === "string" &&
		value.trim() !== ""
	) {
		value = Number(value);
	} else if (
		options.parseBooleans &&
		value !== null &&
		(value.toLowerCase() === "true" || value.toLowerCase() === "false")
	) {
		value = value.toLowerCase() === "true";
	}

	return value;
}

function parse(input, options) {
	options = Object.assign(
		{
			decode: true,
			sort: true,
			arrayFormat: "none",
			parseNumbers: false,
			parseBooleans: false
		},
		options
	);

	const formatter = parserForArrayFormat(options);

	// Create an object with no prototype
	const ret = Object.create(null);

	if (typeof input !== "string") {
		return ret;
	}

	input = input.trim().replace(/^[?#&]/, "");

	if (!input) {
		return ret;
	}

	for (const param of input.split("&")) {
		let [key, value] = splitOnFirst(
			options.decode ? param.replace(/\+/g, " ") : param,
			"="
		);

		// Missing `=` should be `null`:
		// http://w3.org/TR/2012/WD-url-20120524/#collect-url-parameters
		value = value === undefined ? null : decode(value, options);
		formatter(decode(key, options), value, ret);
	}

	for (const key of Object.keys(ret)) {
		const value = ret[key];
		if (typeof value === "object" && value !== null) {
			for (const k of Object.keys(value)) {
				value[k] = parseValue(value[k], options);
			}
		} else {
			ret[key] = parseValue(value, options);
		}
	}

	if (options.sort === false) {
		return ret;
	}

	return (options.sort === true
		? Object.keys(ret).sort()
		: Object.keys(ret).sort(options.sort)
	).reduce((result, key) => {
		const value = ret[key];
		if (Boolean(value) && typeof value === "object" && !Array.isArray(value)) {
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

exports.stringify = (object, options) => {
	if (!object) {
		return "";
	}

	options = Object.assign(
		{
			encode: true,
			strict: true,
			arrayFormat: "none"
		},
		options
	);

	const formatter = encoderForArrayFormat(options);

	const objectCopy = Object.assign({}, object);
	if (options.skipNull) {
		for (const key of Object.keys(objectCopy)) {
			if (objectCopy[key] === undefined || objectCopy[key] === null) {
				delete objectCopy[key];
			}
		}
	}

	const keys = Object.keys(objectCopy);

	if (options.sort !== false) {
		keys.sort(options.sort);
	}

	return keys
		.map(key => {
			const value = object[key];

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
		})
		.filter(x => x.length > 0)
		.join("&");
};

exports.parseUrl = (input, options) => {
	return {
		url: removeHash(input).split("?")[0] || "",
		query: parse(extract(input), options)
	};
};
