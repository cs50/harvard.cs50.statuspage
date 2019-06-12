define(function(require, exports, module) {
    main.consumes = ["dialog.notification", "Plugin", "preferences", "settings", "ui"];
    main.provides = ["harvard.cs50.statuspage"];
    return main;

    function main(options, imports, register) {
        const Plugin = imports.Plugin;
        const notify = imports["dialog.notification"].show;
        const prefs = imports["preferences"];
        const settings = imports.settings;
        const ui = imports.ui;

        // Statuspage library
        require("./lib/se-v2");

        const plugin = new Plugin("Ajax.org", main.consumes);
        const PAGE_ID = "g9mp5m2251ps";
        const statuspage = new StatusPage.page({ page: PAGE_ID});
        let intervalId;
        let notificationsEnabled = true;
        let showingIncidents = [];

        function load() {

            // Load css
            ui.insertCss(require("text!./style.css"), plugin);

            // Settings and preferences
            settings.on("read", () => {

                // Enable status notificataions by default
                settings.setDefaults("user/cs50/statuspage", [
                    ["notifications", true]
                ]);

                // Add preference toggle for notifications
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

            // Toggle status notifications when setting is updated
            settings.on("user/cs50/statuspage/@notifications", value => {
                notificationsEnabled = value;
            });

            // Whether status notifications are enabled initially
            notificationsEnabled = settings.getBool("user/cs50/statuspage/@notifications");

            // Fetch current interval from settings or fallback to default interval
            interval = (settings.getNumber("user/cs50/statuspage/@interval") || 30) * 1000;

            // Update interval when setting is updated
            settings.on("user/cs50/statuspage/@interval", newInterval => {
                interval = newInterval;
            });

            // Fetch and update status initially
            updateIncidents();

            // Fetch and update status periodically
            intervalId = setInterval(updateIncidents, interval);
        }

        /**
         * Shows banner with html content styling it according to category for timeout
         */
        function showBanner(content, resolved, timeout) {

            // Show banner
            return notify('<div class="cs50-statuspage-banner ' +  (resolved ? 'cs50-statuspage-resolved' : '')  +  '">' +
                content + '</div>', true);
        }

        /**
         * Polls statuspage.io periodically for new/updated incidents and shows a banner for each incident update
         */
        function updateIncidents(){

            // Return if stauts notifications are disabled
            if (!notificationsEnabled)
                return;

            // Fetch and update unresolved incidents
            statuspage.incidents({
                filter: "unresolved",
                success(data) {

                    // Fetch unresolved incidetns from settings
                    const unresolvedIncidents = settings.getJson("state/cs50/statuspage/incidents") || {};

                    // Hash incidents for easy indexing
                    const incidents = {};
                    data.incidents.forEach(incident => {

                        // Ignore incidents from other pages
                        if (incident.page_id !== PAGE_ID)
                            return;

                        incidents[incident.id] = {
                            name: incident.name,
                            status: incident.status,
                            shortlink: incident.shortlink
                        };
                    });

                    // Show banner for resolved incidents
                    Object.keys(unresolvedIncidents).forEach(id => {
                        if (!incidents[id]) {

                            // Hide yellow banner (if any) before showing green
                            if (showingIncidents[id])
                                showingIncidents[id]();

                            // Wait until yellow banner is hidden
                            var interval = setInterval(() => {
                                if (showingIncidents[id] && !showingIncidents[id].hasClosed)
                                    return;

                                clearInterval(interval);
                                delete showingIncidents[id];

                                // Show green banner
                                showBanner('<strong>Resolved:</strong> <a href="' + unresolvedIncidents[id].shortlink + '" target="_blank">' +
                                    unresolvedIncidents[id].name + '</a>', true);
                            }, 500);
                        }
                    });

                    // Show banner for potentially new incidents
                    Object.keys(incidents).forEach(id => {
                        if (!unresolvedIncidents[id]) {
                            showingIncidents[id] = showBanner('<a href="' + incidents[id].shortlink + '" target="_blank">' + incidents[id].name + '</a>');
                        }
                    });

                    // Update unresolved incidents in settings
                    settings.setJson("state/cs50/statuspage/incidents", incidents);
                    settings.save();
            }});
        }

        plugin.on("load", () => {
            load();
        });

        plugin.on("unload", () => {
            notificationsEnabled = true;
            showingIncidents = [];
            clearInterval(intervalId);
        });

        plugin.freezePublicAPI({});

        register(null, { "harvard.cs50.statuspage": plugin });
    }
});
