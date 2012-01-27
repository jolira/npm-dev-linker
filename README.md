npm-dev-linker
==========================

This is a little tool for anyone that would like to develop multiple node.js projects concurrently.
When running the script in a directory, it scans all sub-directories for package.json file
and download the appropriate dependencies. It ``npm install``s all dependencies for which it cannot
find any package json file and creates links to the actual projects for the rest.

Install
--------------------------

```
npm install -g npm-dev-linker
```

Usage
--------------------------

```
npm-dev-linker
```

This command first searches all subdirectories for package.json files. Once all valid projects
are found in the directory tree, the program is visiting every project and performs an ``npm 
install`` for all dependencies that need to be downloaded from the internet and creates a 
symbolic link to all projects that are available locally.
