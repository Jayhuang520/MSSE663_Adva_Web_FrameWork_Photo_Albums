$(function(){

    var tmpl,
        tdata = {};

    var initPage = function() {


        $.get("/templates/secret.html", function(d){
            tmpl = d;
        });

        $(document).ajaxStop(function () {
            var renderedPage = Mustache.to_html( tmpl, tdata );
            $("body").html( renderedPage );
        })
    }();
});
