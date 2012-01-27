var _ = require("underscore");
var path = require('path');
var npm = require("npm");
var fs = require('fs');

npm.on("log", function (message) {
  //console.log("npm: ", message);
})

function findPackageJSONPaths(dir, callback, projects) {
  projects = projects || [];
  
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
        projects.push(dir);
        return callback(undefined, projects);
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

function installProject(projects, deps, relative, cb) {
  var keys = _.keys(deps);
  var dep = keys[0];
  
  if (!dep) {
    return cb();
  }
  
  var version = deps[dep];
  
  delete deps[dep];
    
  var project = _.find(projects, function(project) {
    var basename = path.basename(project);
    
    return dep === basename;
  });

  if (project) {
    return ensureNodeModules(function(err) {
      if (err) {
        return cb(err);
      }

      var target = path.join("node_modules", project);
      
      return fs.stat(target, function(err, stats){
        if (err) {
          var src = path.join("..", relative, project);

          fs.symlink(src, target, "dir", function(err) {
            if (err) {
              return cb(err);
            }

            return installProject(projects, deps, relative, cb);
          });
        }

        return installProject(projects, deps, relative, cb);
      });
    });
  }

  npm.commands.install([dep + '@' + version], function(err) {
    if (err) {
      return cb(err);
    }
    
    installProject(projects, deps, relative, cb);
  });
}

function install(projects, project, callback) {
  var pkgJsonFile = path.join(project, "package.json");

  fs.readFile(pkgJsonFile, function(err, data) {
    if (err) {
     return callback(err);
    }

    var pkgJson = JSON.parse(data);
    var deps = getDepedencies(pkgJson);
    var pwd = process.cwd();
   
    process.chdir(project);
    
    var cb = function(err) {
      process.chdir(pwd);
      callback(err);
    };

    npm.load({}, function(err) {
      if (err) {
        return cb(err);
      }
      
      var relative = path.relative(process.cwd(), pwd);

      installProject(projects, deps, relative, cb);
    });
  });
}

function installAll(projects, cb, remaining) {
  remaining = remaining || _.clone(projects);
  var project = remaining.shift();
  
  if (!project) {
    return cb();
  }
  
  install(projects, project, function(err){
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