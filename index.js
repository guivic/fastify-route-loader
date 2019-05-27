const fastifyPlugin = require('fastify-plugin');
const fastGlob = require('fast-glob');
const path = require('path');

/**
 * Extract the method and url from a route config Object.
 * @param {Object} Object that contains the filaname and routeConfig
 * @return {Object} An Object with the extracted method and url
 */
function parseRouteConfig({ filename, routeConfig }) {
	const filenameWithoutExt = filename.split('.')[0].toLowerCase();

	if (filenameWithoutExt === 'create') {
		return {
			method: 'post',
			url:    '/',
		};
	} if (filenameWithoutExt === 'update') {
		return {
			method: 'put',
			url:    '/:id',
		};
	} if (filenameWithoutExt === 'delete') {
		return {
			method: 'delete',
			url:    '/:id',
		};
	} if (filenameWithoutExt === 'list') {
		return {
			method: 'get',
			url:    '/',
		};
	} if (filenameWithoutExt === 'read') {
		return {
			method: 'get',
			url:    '/:id',
		};
	}

	return {
		method: routeConfig.method,
		url:    routeConfig.url,
	};
}

/**
 * Return the prefix that will be applied to the route
 * @param {String} baseFolderName - The root folder name
 * @param {String} filePath - The path to the file
 * @return {String} The prefix (can be multiple string concatenated)
 */
function getPrefix(baseFolderName, filePath) {
	const folders = path.dirname(filePath).split(path.sep);

	if (!baseFolderName) {
		return folders.pop();
	}

	const foldersSaved = [];
	let saveNext = false;
	for (let i = 0; i < folders.length; i++) {
		if (saveNext) {
			foldersSaved.push(folders[i]);
		}
		if (folders[i] === baseFolderName) {
			saveNext = true;
		}
	}
	return path.join(...foldersSaved);
}

/**
 * The Fastify guivic routes loader plugin
 * @param {Object} fastifyGlobalPlugin - Fastify instance
 * @param {Object} options - Plugin's options
 * @param {Function} nextGlobalPlugin - Fastify next callback
 */
function fastifyGuivicRoutesLoader(fastifyGlobalPlugin, options, nextGlobalPlugin) {
	const files = fastGlob.sync(options.paths);
	const prefixs = {};
	const { baseFolderName } = options;

	for (let i = 0; i < files.length; i++) {
		const filename = path.basename(files[i]);
		const routeConfig = require(path.resolve(files[i]));
		const prefix = getPrefix(baseFolderName, files[i]);

		if (!prefixs[prefix]) {
			prefixs[prefix] = [];
		}
		prefixs[prefix].push({
			filename,
			routeConfig,
		});
	}

	const prefixsKeys = Object.keys(prefixs);
	for (let prefixIndex = 0; prefixIndex < prefixsKeys.length; prefixIndex++) {
		const prefix = prefixsKeys[prefixIndex];

		fastifyGlobalPlugin.register((fastify, opts, next) => {
			for (let i = 0; i < prefixs[prefix].length; i++) {
				const { method, url } = parseRouteConfig(prefixs[prefix][i]);

				fastify[method](
					url,
					prefixs[prefix][i].routeConfig.options || {},
					(req, res) => prefixs[prefix][i].routeConfig.handler(fastify, req, res),
				);
			}
			next();
		}, {
			prefix,
		});
	}

	nextGlobalPlugin();
}

module.exports = fastifyPlugin(fastifyGuivicRoutesLoader, {
	name: 'fastify-routes-loader',
});
