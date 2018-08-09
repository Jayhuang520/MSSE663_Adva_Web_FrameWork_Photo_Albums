var fs = require('fs'),
    helpers = require('./helpers.js'),
    rename = require('./rename.js');

exports.version = '0.1.0';

exports.doRename = function (oldName, newName, callback) {
    console.log('Old Name: ' + oldName + ' New Name: ' + newName);

    fs.rename("static/albums/" + oldName, "static/albums/" + newName, callback);
};

exports.renameAlbum = function (req, res) {
    var oldName = req.body.oldName,
        newName = req.body.newName;
    var array = {oldName: oldName, newName: newName};
    if (!array.oldName && !array.newName)  {
        helpers.send_failure(res, 403);
        return;
    }

    rename.doRename(
        array.oldName,
        array.newName,
        function (err, results) {
            if (array.old) {
                helpers.send_failure(res, 403, helpers.no_such_album());
                return;
            }
            res.redirect('http://localhost:8080/pages/home');
        }
    );
};