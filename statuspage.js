define(function(require, exports, module) {
    main.consumes = ["Plugin", "dialog.notification", "preferences", "settings", "ui"];
    main.provides = ["harvard.cs50.statuspage"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var notify = imports["dialog.notification"].show;
        var prefs = imports["preferences"];
        var settings = imports.settings;
        var ui = imports.ui;

        // statuspage library
        require("./lib/se-v2");

        var plugin = new Plugin("Ajax.org", main.consumes);

        var statuspage = new StatusPage.page({ page: "g9mp5m2251ps"});
        var duration;
        var intervalId;
        var notificationsEnabled = true;

        function load() {

            // load css
            ui.insertCss(require("text!./style.css"), options.staticPrefix, plugin);

            // settings and preferences
            settings.on("read", function() {

                // enable status notificataions by default
                settings.setDefaults("user/cs50/statuspage", [
                    ["duration", 5],
                    ["notifications", true]
                ]);

                // add preference spinner for notification duration
                prefs.add({
                   "CS50" : {
                        position: 5,
                        "IDE Information" : {
                            position: 10,
                            "Status Notification Duration (in seconds)" : {
                                type: "spinner",
                                path: "user/cs50/statuspage/@duration",
                                min: 1,
                                position: 200
                            }
                        }
                    }
                }, plugin);

                // add preference toggle for notifications
                prefs.add({
                   "CS50" : {
                        position: 5,
                        "IDE Behavior" : {
                            position: 10,
                            "Status Notifications" : {
                                type: "checkbox",
                                setting: "user/cs50/statuspage/@notifications",
                                position: 190
                            }
                        }
                    }
                }, plugin);
            });

            // toggle status notifications when setting is updated
            settings.on("user/cs50/statuspage/@notifications", function (value) {
                notificationsEnabled = value;
            });

            // whether status notifications are enabled initially
            notificationsEnabled = settings.getBool("user/cs50/statuspage/@notifications");

            // fetch current interval from settings or fallback to default interval
            interval = (settings.getNumber("user/cs50/statuspage/@interval") || 30) * 1000;

            // update interval when setting is updated
            settings.on("user/cs50/statuspage/@interval", function(newInterval) {
                interval = newInterval;
            });

            // fetch current duration from settings or fallback to default duration
            duration = (settings.getNumber("project/cs50/statuspage/@duration") || 5) * 1000;

            // update duration when setting is updated
            settings.on("user/cs50/statuspage/@duration", function(newDuration) {
                duration = newDuration;
            });

            // fetch and update status initially
            updateIncidents();

            // fetch and update status periodically
            intervalId = setInterval(updateIncidents, interval);
        }

        /**
         * Shows banner with html content styling it according to category for timeout
         */
        function showBanner(content, resolved, timeout) {

            // show banner
            var hide = notify('<div class="cs50-statuspage-banner ' +  (resolved ? 'cs50-statuspage-resolved' : '')  +  '">' +
                content + '</div>', true);

            // hide banner after timeout or fallback to default timeout
            setTimeout(function() {
                hide();
            }, timeout || duration)
        }

        /**
         * Polls statuspage.io periodically for new/updated incidents and shows a banner for each incident update
         */
        function updateIncidents(){

            // return if stauts notifications are disabled
            if (!notificationsEnabled)
                return;

            // fetch and update unresolved incidents
            statuspage.incidents({
                filter: "unresolved",
                success: function(data) {

                    // fetch unresolved incidetns from settings
                    var unresolvedIncidents = settings.getJson("project/cs50/statuspage/@incidents") || {};

                    // hash incidents for easy indexing
                    var incidents = {};
                    data.incidents.forEach(function(incident) {

                        // ignore incidents from other pages
                        if (incident.page_id !== "g9mp5m2251ps")
                            return;

                        incidents[incident.id] = {
                            name: incident.name,
                            status: incident.status,
                            shortlink: incident.shortlink
                        };
                    });

                    // show banner for resolved incidents
                    Object.keys(unresolvedIncidents).forEach(function(id) {
                        if (!incidents[id]) {
                            showBanner('<strong>Resolved:</strong> <a href="' + unresolvedIncidents[id].shortlink + '" target="_blank">' +
                                unresolvedIncidents[id].name + '</a>', true);
                        }
                    });

                    // show banner for potentially new incidents
                    Object.keys(incidents).forEach(function(id) {
                        if (!unresolvedIncidents[id]) {
                            showBanner('<a href="' + incidents[id].shortlink + '" target="_blank">' + incidents[id].name + '</a>');
                        }
                    });

                    // update unresolved incidents in settings
                    settings.setJson("project/cs50/statuspage/@incidents", incidents);
            }});
        }

        plugin.on("load", function() {
            load();
        });

        plugin.on("unload", function() {
            duration = null;
            notificationsEnabled = true;
            clearInterval(intervalId);
        });

        plugin.freezePublicAPI({});

        register(null, { "harvard.cs50.statuspage": plugin });
    }
});
