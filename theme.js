/**
 * Plugin to load the specified CSS file(s), substituting {{theme}} with the theme for the current page.
 * 
 * For example, on an iPhone `theme!./css/{{theme}}/common,./Button/{{theme}}/Button`
 * will load (in the following order if the css files are not already loaded):
 * 
 * - ./css/ios/common
 * - ./Button/ios/Button
 * 
 * You can also pass an additional URL parameter string
 * `theme={theme widget}` to force a specific theme through the browser
 * URL input. The available theme ids are bootstrap, holodark (theme introduced in Android 3.0)
 * and ios. The theme names are case-sensitive. If the given
 * theme does not match, the bootstrap theme is used.
 *
 * ```
 * http://your.server.com/yourapp.html --> automatic detection
 * http://your.server.com/yourapp.html?theme=holodark --> forces Holodark theme
 * http://your.server.com/yourapp.html?theme=ios --> forces iPhone theme
 * ```
 *
 * You can also specify a particular user agent through the `ua=...` URL parameter.
 *  @module delite/theme
 */
define([
	"require",
	"requirejs-dplugins/has",
	"module",
	"./load-css"
], function (req, has, module, css) {

	"use strict";

	var config = module.config();
	
	var loadList = [];
	
	var writePluginFiles;
	
	var load = /** @lends module:delite/theme */ {
		/**
		 * A map of user-agents to theme files.
		 *
		 * The first array element is a regexp pattern that matches the userAgent string.
		 * The second array element is a theme folder widget.
		 * The matching is performed in the array order, and stops after the first match.
		 *
		 * Can be overridden by a module-level configuration setting passed to AMD loader:
		 *
		 * ```js
		 * require.config({
		 *     config: {
		 *         "delite/theme": {
		 *             themeMap: ...
		 *         }
		 *     }
		 * });
		 * ```
		 * @member {Array}
		 * @default [[/Holodark|Android/, "holodark"], [/iPhone/iPad/, "ios"], [/.*\/, "bootstrap"]]
		 */
		themeMap: config.themeMap || [
			[/Holodark|Android/, "holodark"],
			[/iPhone|iPad/, "ios"],
			[/.*/, "bootstrap"]			// chrome, firefox, IE
		],

		/**
		 * Compute the theme name, according to browser and this.themeMap.
		 * @private
		 */
		getTheme: function () {
			var theme = load.theme || config.theme;
			if (!theme) {
				var matches = location.search.match(/theme=(\w+)/);
				theme = matches && matches.length > 1 ? matches[1] : null;
			}
			if (!theme) {
				var ua = config.userAgent || (location.search.match(/ua=(\w+)/) ? RegExp.$1 : navigator.userAgent),
					themeMap = this.themeMap;
				for (var i = 0; i < themeMap.length; i++) {
					if (themeMap[i][0].test(ua)) {
						theme = themeMap[i][1];
						break;
					}
				}
			}
			load.theme = theme;
			return theme;
		},

		/**
		 * Convert relative paths to absolute ones.   By default only the first path (in the comma
		 * separated list) is converted.
		 * @private
		 */
		normalize: css.normalize,

		/**
		 * Load and install the specified CSS files for the given logicalPaths, then call onload().
		 * @param {string} logicalPaths - Comma separated list of simplified paths.
		 * They will be expanded to convert {{theme}} to the current theme.
		 * @param {Function} require - AMD's require() method.
		 * @param {Function} onload - Callback function which will be called when the loading finishes
		 * and the stylesheet has been inserted.
		 * @private
		 */
		load: function (logicalPaths, require, onload, loaderConfig) {
			// Add CSS file which contains definitions global to the theme.
			logicalPaths = "delite/themes/{{theme}}/global.css" + (logicalPaths ? "," + logicalPaths : "");

			if (loaderConfig.isBuild) {
				css.buildFunctions.buildLoadList(loadList, logicalPaths);
				onload();
				return;
			}
			
			// Replace single css bundles by corresponding layer.
			if (config.layersMap) {
				logicalPaths = css.buildFunctions.getLayersToLoad(config.layersMap, logicalPaths);
			}
						
			// Convert list of logical paths into list of actual paths
			// ex: Button/css/{{theme}}/Button --> Button/css/ios/Button
			var actualPaths = logicalPaths.replace(/{{theme}}/g, load.getTheme());

			// Make single call to css! plugin to load resources in order specified
			req([ "./load-css!" + actualPaths ], function () {
				onload(arguments);
			});
		},
		
		writeFile: function (pluginName, resource, require, write) {
			writePluginFiles = write;
		},
		
		onLayerEnd: function (write, data) {
			function getLayerPath(theme) {
				var pathRE = /^(?:\.\/)?(([^\/]*\/)*)[^\/]*$/;
				return data.path.replace(pathRE, "$1themes/layer_" + (theme || "{{theme}}") + ".css");
			}

			if (data.name && data.path) {
				var CleanCSS = require("clean-css");
				load.themeMap.forEach(function (theme) {
					var themeDir = theme[1];
					var dest = getLayerPath(themeDir);
					var themedLoadList = loadList.map(function (path) {
						return require.toUrl(path.replace(/{{theme}}/g, themeDir));
					});
					css.buildFunctions.writeLayer(writePluginFiles, CleanCSS, dest, themedLoadList);
				});
				
				// Write css config on the layer
				css.buildFunctions.writeConfig(write, module.id, getLayerPath(), loadList);
				
				// Reset loadList
				loadList = [];
			}
		}
	};

	return load;
});
