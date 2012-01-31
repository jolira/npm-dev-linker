var _ = require("underscore");
var path = require('path');
var fs = require('fs');
exec = require('child_process').exec;

function readProject(project, cb) {
  var pkgJsonFile = path.join(project, "package.json");

  fs.readFile(pkgJsonFile, function(err, data) {
    if (err) {
     return callback(err);
    }

    cb(undefined, JSON.parse(data));
  });
}

function addProject(projects, project, cb) {
  readProject(project, function(err, pkg) {
    if (err) {
      return cb(err);
    }
    
    var name = pkg.name;
    var existing = projects[name];
    
    if (existing) {
      return cb(new Error("project " + name + " is defined in " + project + " as well as " + existing));
    }

    projects[name] = project;
    cb(undefined, projects);
  });
}

function findPackageJSONPaths(dir, callback, projects) {
  projects = projects || {};

  if (dir != "." && dir[0] == ".") {
    return callback(undefined, projects);
  }

  fs.stat(dir, function(err, stats){
    if (err) {
      return callback(err, projects);
    }

    if (!stats.isDirectory()) {
      return callback(undefined, projects);
    }

    fs.readdir(dir, function(err, files){
      if (err) {
        return callback(err, projects);
      }

      var found = _.find(files, function(file) {
        var basename = path.basename(file);

        return basename === "package.json";
      });
    
      if (found) {
        return addProject(projects, dir, callback);
      }
      
      var cb = callback;
      var expected = files.length;
      var actual = 0;

      _.each(files, function(file){
        var _dir = path.join(dir, file);

        if (cb) {
          findPackageJSONPaths(_dir, function(err, dirs) {          
            if (err) {
              cb(err);
              cb = undefined;
            }

            if (++actual === expected) {
              return cb(undefined, dirs);
            }
          }, projects);
        }
      });
    });
  });
}

function getDepedencies(pkg) {
  var devDeps = pkg.devDependencies || {};
  var deps = pkg.dependencies || {};
  
  _.each(deps, function(value, key) {
    devDeps[key] = value;
  });
  
  return devDeps;
}

function ensureNodeModules(cb) {
  fs.stat("node_modules", function(err, stats){
    if (err) {
      return fs.mkdir("node_modules", function (err) {
        cb(err);
      });
    }
    cb();
  });
}

function installDependencies(projects, deps, relative, cb) {
  var keys = _.keys(deps);
  var dep = keys[0];
  
  if (!dep) {
    return cb();
  }
  
  var version = deps[dep];
  
  delete deps[dep];

  var project = projects[dep];

  if (project) {
    return ensureNodeModules(function(err) {
      if (err) {
        return cb(err);
      }

      var target = path.join("node_modules", project);
      
      return fs.stat(target, function(err, stats){
        if (err) {
          var src = path.join("..", relative, project);

          return fs.symlink(src, target, "dir", function(err) {
            if (err) {
              return cb(err);
            }

            return installDependencies(projects, deps, relative, cb);
          });
        }

        return installDependencies(projects, deps, relative, cb);
      });
    });
  }

  var lib = dep + '@' + version;
  
  exec('npm install "' + lib + '"',
    function (error, stdout, stderr) {
      console.log(stdout);
      console.error(stderr);

      if (error) {
        return cb(error);
      }
      installDependencies(projects, deps, relative, cb);
  });
}

function chdir(dir) {
  process.chdir(dir);
}

function installProject(projects, project, callback) {
  readProject(project, function(err, pkgJson) {
    if (err) {
     return callback(err);
    }

    var name = pkgJson.name;
    var deps = getDepedencies(pkgJson);
    var pwd = process.cwd();
    var dir = projects[name];

    chdir(dir);
    
    var cb = function(err) {
      chdir(pwd);
      callback(err);
    };

      
    var relative = path.relative(process.cwd(), pwd);

    installDependencies(projects, deps, relative, cb);
  });
}

function installAll(projects, cb, remaining) {
  remaining = remaining || _.values(projects);
  var project = remaining.shift();
  
  if (!project) {
    return cb();
  }
  
  installProject(projects, project, function(err){
    if (err) {
      return cb(err);
    }

    installAll(projects, cb, remaining);
  });
}

module.exports = function(dir, cb) {
  findPackageJSONPaths(dir, function(err, projects) {
    if (err) {
      return cb(err);
    }
    
    installAll(projects, function(err) {
      cb(err, projects);
    });
  });
};