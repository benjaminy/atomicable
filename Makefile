a_test:
	node --experimental-modules Source/runPluginOnFile.mjs Testing/t2.mjs > Build/x.mjs
	node --experimental-modules Build/x.mjs
