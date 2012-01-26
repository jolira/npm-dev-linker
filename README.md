npm-dev-linker
==========================

This is a little tool for anyone that would like to develop multiple node.js projects concurrently.
When running the script in a directory, it scans all sub-directories for package.json file
and download the appropriate dependencies. It ``npm install``s all dependencies for which it cannot
find any package json file and creates links to the actual projects for the rest.
