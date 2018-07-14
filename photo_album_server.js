var http = require('http'),
    fs = require('fs'),
    async = require('async'),
    path = require('path'),
    url = require('url');

function handle_incoming_request(req, res) {

    req.parsed_url = url.parse(req.url, true);
    var core_url = req.parsed_url.pathname;
    if (core_url.substring(0, 7) == '/pages/') {
        serve_page(req, res);
    } else if (core_url.substring(0, 11) == '/templates/') {
        serve_static_file("templates/" + core_url.substring(11), res);
    } else if (core_url.substring(0, 9) == '/content/') {
        serve_static_file("content/" + core_url.substring(9), res);
    } else if (core_url == '/albums.json') {
        handle_list_albums(req, res);
    } else if (core_url.substr(core_url.length - 12) == '/rename.json'
        && req.method.toLowerCase() == 'post') {
        handle_rename_album(req, res);
    } else if (core_url.substr(0, 7) == '/albums'
        && core_url.substr(core_url.length - 5) == '.json') {
        handle_get_album(req, res);
    } else if ((core_url.substr(0, 7) == '/albums') &&
        ((core_url.substr(core_url.length - 5) == '.jpeg') ||
            (core_url.substr(core_url.length - 4) == '.jpg'))) {
        serve_static_file("." + core_url, res);
    }
    else {
        send_failure(res, 404, invalid_resource());
    }
    console.log("INCOMING REQUEST: " + req.method + " " + req.url);
}

function load_album_list(callback) {
    fs.readdir(
        "albums",
        function (err, files) {
            if (err) {
                callback(make_error("file_error", JSON.stringify(err)));
                return;
            }
            var only_dirs = [];
            async.forEach(files, function (element, cb) {
                    fs.stat("albums/" + element, function (err, stats) {
                            if (err) {
                                cb({
                                    error: "file_error",
                                    message: JSON.stringify(err)
                                });
                                return;
                            }
                            if (stats.isDirectory()) {
                                only_dirs.push({name: element});
                            }
                            cb(null);
                        }
                    );
                },
                function (err) {
                    callback(err, err ? null : only_dirs);
                });
        });
}

function load_album(album_name, page, page_size, callback) {
    fs.readdir(
        "albums/" + album_name,
        function (err, files) {
            if (err) {
                if (err.code == "ENOENT") {
                    callback(no_such_album());
                } else {
                    callback({
                        error: "file_error",
                        message: JSON.stringify(err)
                    });
                }
                return;
            }
            var only_files = [];
            var path = "albums/" + album_name + "/";

            async.forEach(files, function (element, cb) {
                    fs.stat(path + element, function (err, stats) {
                        if (err) {
                            cb({
                                error: "file_error",
                                message: JSON.stringify(err)
                            });
                            return;
                        }
                        if (stats.isFile()) {
                            var obj = {
                                filename: element,
                                desc: element
                            };
                            only_files.push(obj);
                        }
                        cb(null);
                    });
                },
                function (err) {
                    if (err) {
                        callback(err);
                    } else {
                        var start = page * page_size;
                        var photos = only_files.slice(start, start + page_size);
                        var obj = {
                            short_name: album_name.substring(1),
                            photos: photos
                        };
                        callback(null, obj);
                    }
                });
        });
}

function serve_page(req, res) {
    var page = get_page_name(req);

    fs.readFile('basic.html', function (err, contents) {
        if (err) {
            send_failure(res, 500, err);
            return;
        }

        contents = contents.toString('utf8');

        // replace page name, and then dump to output.
        contents = contents.replace('{{PAGE_NAME}}', page);
        res.writeHead(200, {"Content-Type": "text/html"});
        res.end(contents);
    });
}

function serve_static_file(file, res) {
    var rs = fs.createReadStream(file);
    var ct = content_type_for_path(file);
    res.writeHead(200, {"Content-Type": ct});

    rs.on('error', function (e) {
        res.writeHead(404, {"Content-Type": "application/json"});
        var out = {
            error: "not_found",
            message: "'" + file + "' not found"
        };
        res.end(JSON.stringify(out) + "\n");
        return;
    });

    rs.on('readable', function () {
        var d = rs.read();
        if (d) {
            res.write(d);
        }
    });

    rs.on('end', function () {
        res.end();  // we're done!!!
    });
}

function content_type_for_path(file) {
    var ext = path.extname(file);
    switch (ext.toLowerCase()) {
        case '.html':
            return "text/html";
        case ".js":
            return "text/javascript";
        case ".css":
            return 'text/css';
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        default:
            return 'text/plain';
    }
}

function handle_list_albums(req, res) {
    load_album_list(function (err, albums) {
        if (err) {
            send_failure(res, 500, err);
            return;
        }
        send_success(res, {albums: albums});
    });
}

function handle_get_album(req, res) {

    var album_name = get_album_name(req);
    var getp = get_query_params(req);
    var page_num = getp.page ? getp.page : 0;
    var page_size = getp.page_size ? getp.page_size : 1000;

    if (isNaN(parseInt(page_num))) page_num = 0;
    if (isNaN(parseInt(page_size))) page_size = 1000;

    load_album(album_name, page_num, page_size, function (err, album_contents) {
        if (err && err == "no_such_album") {
            send_failure(res, 404, err);
        } else if (err) {
            send_failure(res, 500, err);
        } else {
            send_success(res, {album_data: album_contents});
        }
    });
}

function do_rename(old_name, new_name, callback) {
    console.log('Old Name: ' + old_name + ' New Name: ' + new_name);
    fs.rename("albums/" + old_name, "albums/" + new_name, callback);

}

function handle_rename_album(req, res) {

    // 1. Get the album name from the URL
    var core_url = req.parsed_url.pathname;
    var parts = core_url.split('/');
    if (parts.length != 4) {
        send_failure(res, 404, invalid_resource(core_url));
        return;
    }
    var album_name = parts[2];
    // 2. get the POST data for the request. this will have the JSON
    // for the new name for the album.
    var json_body = '';
    req.on(
        'readable',
        function () {
            var d = req.read();
            if (d) {
                if (typeof d == 'string') {
                    json_body += d;
                } else if (typeof d == 'object' && d instanceof Buffer) {
                    json_body += d.toString('utf8');
                }
            }
        }
    );
    // 3. when we have all the post data, make sure we have valid
    // data and then try to do the rename.
    req.on(
        'end',
        function () {
            // did we get a body?
            if (json_body) {
                try {
                    var album_data = JSON.parse(json_body);
                    if (!album_data.album_name) {
                        send_failure(res, 403, missing_data('album_name'));
                        return;
                    }
                } catch (e) {
                    // got a body, but not valid json
                    send_failure(res, 403, bad_json());
                    return;
                }
                // 4. Perform rename!
                do_rename(
                    album_name, // old
                    album_data.album_name, // new
                    function (err, results) {
                        if (err && err.code == "ENOENT") {
                            send_failure(res, 403, no_such_album());
                            return;
                        } else if (err) {
                            send_failure(res, 500, file_error(err));
                            return;
                        }
                        send_success(res, null);
                    }
                );
            } else { // didn't get a body
                send_failure(res, 403, bad_json());
                res.end();
            }
        }
    );
}

function make_error(err, msg) {
    var e = new Error(msg);
    e.code = err;
    return e;
}

function send_success(res, data) {
    res.writeHead(200, {"Content-Type": "application/json"});
    var output = {error: null, data: data};
    res.end(JSON.stringify(output) + "\n");
}

function send_failure(res, server_code, err) {
    var code = (err.code) ? err.code : err.name;
    res.writeHead(server_code, {"Content-Type": "application/json"});
    res.end(JSON.stringify({error: code, message: err.message}) + "\n");
}

function invalid_resource() {
    return {
        error: "invalid_resource",
        message: "the requested resource does not exist."
    };
}

function no_such_album() {
    return {
        error: "no_such_album",
        message: "The specified album does not exist"
    };
}

function get_album_name(req) {
    var core_url = req.parsed_url.pathname;
    return core_url.substr(7, core_url.length - 12);
}

function get_template_name(req) {
    var core_url = req.parsed_url.pathname;
    return core_url.substring(11);       // remove /templates/
}

function get_query_params(req) {
    return req.parsed_url.query;
}

function get_page_name(req) {
    var core_url = req.parsed_url.pathname;
    var parts = core_url.split("/");
    return parts[2];
}

var s = http.createServer(handle_incoming_request);
s.listen(8080);
