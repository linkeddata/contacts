var PROXY = "https://rww.io/proxy.php?uri={uri}";
var TIMEOUT = 90000;
var DEBUG = true;
// Namespaces
var RDF = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
var RDFS = $rdf.Namespace("http://www.w3.org/2000/01/rdf-schema#");
var FOAF = $rdf.Namespace("http://xmlns.com/foaf/0.1/");
var OWL = $rdf.Namespace("http://www.w3.org/2002/07/owl#");
var PIM = $rdf.Namespace("http://www.w3.org/ns/pim/space#");
var UI = $rdf.Namespace("http://www.w3.org/ns/ui#");
var DCT = $rdf.Namespace("http://purl.org/dc/terms/");
var SOLID = $rdf.Namespace("http://www.w3.org/ns/solid/app#");
var VCARD = $rdf.Namespace("http://www.w3.org/2006/vcard/ns");

var scope, gg;

$rdf.Fetcher.crossSiteProxyTemplate=PROXY;

var Contacts = angular.module('Contacts', ['lumx']);

Contacts.controller('Main', function($scope, $http, $sce, LxNotificationService, LxProgressService, LxDialogService) {
    $scope.initialized = false;
    $scope.loggedIn = false;
    $scope.loginTLSButtonText = "Login";

    $scope.app = {};
    $scope.app.origin = window.location.origin;
    $scope.app.homepage = "https://linkeddata.github.io/contacts/";
    $scope.app.icon = "https://linkeddata.github.io/contacts/images/favicon.png";
    $scope.app.name = "Contacts";
    $scope.app.description = "A personal address book manager";

    $scope.loginWidget = $sce.trustAsResourceUrl('https://linkeddata.github.io/signup/index.html?ref='+$scope.app.origin);

    // $scope.my = {
    //     name: "Andrei Vlad Sambra",
    //     email: "andrei@w3.org",
    //     picture: "https://deiu.me/public/avatar.jpg"
    // };

    // App user model
    $scope.my = {
        config: {
            workspaces: [],
            availableWorkspaces: []
        }
    };

    // chosen storage URI for the app workspace
    $scope.storageURI = {};
    // temporary list of selected contacts
    $scope.selectedContacts = [];

    // list of contacts
    $scope.contacts = [
        {
            name: "John Doe",
            email: "first@email.com",
            picture: 'https://lh4.googleusercontent.com/-dPvV6bpyaik/U_VfpkP5nnI/AAAAAAAAFHQ/6TKGdHRHFSU/w960-h962-no/1306d2a9-ea03-45e2-bdcd-ef48119c965b',
            favorite: '',
            checked: false
        },
        {
            name: "Jane Smith",
            email: "second@example.org",
            phone: "+1-231-114-1231",
            picture: "https://lh6.googleusercontent.com/-yqYqI3T_KRs/VYKVXGXWW_I/AAAAAAAAAwU/Bd84tPHEcoM/s500-no/Untitled-61142014104414PM.jpg",
            favorite: 'favorite',
            checked: false
        }
    ];

    // Load a user's profile
    // string uri  - URI of resource containing profile information
    // string forWebID - whether it loads extended profile documents for a given WebID
    $scope.getProfile = function(uri, forWebID) {
        var webid = (forWebID)?forWebID:uri;

        if (!$scope.my.webid || $scope.my.webid.length == 0) {
            $scope.my.webid = webid;
        }

        var g = $rdf.graph();
        var f = $rdf.fetcher(g, TIMEOUT);

        var docURI = (uri.indexOf('#') >= 0)?uri.slice(0, uri.indexOf('#')):uri;
        var webidRes = $rdf.sym(webid);
        // Show loading bar
        LxProgressService.linear.show('#E1F5FE', '#progress');
        // Fetch user data
        f.nowOrWhenFetched(docURI,undefined,function(ok, body, xhr) {
            if (!ok) {
                console.log('Warning - profile not found.');
                var extra = '';
                if (forWebID) {
                    extra = 'additional';
                }
                console.log('Failed to fetch '+extra+' profile '+uri+'. HTTP '+xhr.status);
                if (!$scope.my.name) {
                    $scope.my.name = webid;
                }
                // Hide loading bar
                LxProgressService.linear.hide('#progress');
                $scope.loginTLSButtonText = "Login";
                $scope.$apply();
                // return promise
                // reject(ok, body, xhr);
            } else {
                // set time of loading
                if (!$scope.my.loadDate) {
                    $scope.my.loadDate = Date.now();
                }

                // Load additional data from sameAs, seeAlso and preferenceFile
                if (!forWebID) {
                    var sameAs = g.statementsMatching(webidRes, OWL('sameAs'), undefined);
                    if (sameAs.length > 0) {
                        sameAs.forEach(function(same){
                            $scope.getProfile(same['object']['value'], webid);
                        });
                    }
                    var seeAlso = g.statementsMatching(webidRes, OWL('seeAlso'), undefined);
                    if (seeAlso.length > 0) {
                        seeAlso.forEach(function(see){
                            $scope.getProfile(see['object']['value'], webid);
                        });
                    }
                    var prefs = g.statementsMatching(webidRes, PIM('preferencesFile'), undefined);
                    if (prefs.length > 0) {
                        if (prefs[0]['object']['value']) {
                            $scope.getProfile(prefs[0]['object']['value'], webid);
                            $scope.my.config.preferencesFile = prefs[0]['object']['value'];
                        }
                    }
                    $scope.my.toLoad = sameAs.length + seeAlso.length + prefs.length + 1;
                }

                // Fullname
                if (!$scope.my.name || $scope.my.name.length == 0) {
                    var name = g.any(webidRes, FOAF('name'));
                    if (!name || name.value.length == 0) {
                        name = '';
                    }
                    $scope.my.name = name.value;
                }
                
                // Get profile picture
                if (!$scope.my.picture || $scope.my.picture.length == 0) {
                    var img = g.any(webidRes, FOAF('img'));
                    var pic;
                    if (img) {
                        pic = img;
                    } else {
                        // check if profile uses depic instead
                        var depic = g.any(webidRes, FOAF('depiction'));  
                        if (depic) {
                            pic = depic;
                        }
                    }
                    if (pic && pic.value.length > 0) {
                        $scope.my.picture = pic.value;
                    }
                }

                // Get storage location
                if (!$scope.my.config.storages || $scope.my.config.storages.length === 0) {
                    $scope.my.config.storages = [];
                    var storages = g.statementsMatching(webidRes, PIM('storage'), undefined);
                    if (storages && storages.length > 0) {
                        for (var i=0; i<storages.length; i++) {
                            $scope.my.config.storages.push(
                                {
                                    uri: storages[i]['object']['value'],
                                    checked: (i===0)?true:false
                                }
                            );
                        }
                    }
                }

                // Get workspaces
                if (!$scope.my.config.availableWorkspaces || $scope.my.config.availableWorkspaces.length === 0) {
                    var workspaces = g.statementsMatching(webidRes, PIM('workspace'), undefined);
                    if (workspaces && workspaces.length > 0) {
                        for (var i=0; i<workspaces.length; i++) {
                            var ws = workspaces[i];
                            var config = g.statementsMatching(ws['object'], RDF('type'), SOLID('ConfigurationWorkspace'))[0];
                            if (config) {
                                $scope.my.config.appWorkspace = config['subject']['value'];
                                // Also get app data config
                                $scope.fetchAppConfig(g, config['subject']['value']);
                                continue;
                            }
                            var wsTitle = g.any(ws['object'], DCT('title'));
                            $scope.my.config.availableWorkspaces.push({ 
                                uri: ws['object']['value'],
                                name: (wsTitle)?wsTitle.value:'Untitled workspace'
                            });
                        };
                    } else {
                        //@@TODO no workspaces found
                        // write to a container in storage?
                    }
                }

                $scope.my.toLoad--;

                if ($scope.my.toLoad === 0) {
                    // Hide loading bar
                    LxProgressService.linear.hide('#progress');
                    $scope.saveLocalStorage();
                    scope = $scope;
                    gg = g;
                }

                $scope.$apply();
            }
        });
    };

    // Fetch and look for our app in configuration resources
    $scope.fetchAppConfig = function(graph, uri) {
        var f = $rdf.fetcher(graph, TIMEOUT);

        var docURI = (uri.indexOf('#') >= 0)?uri.slice(0, uri.indexOf('#')):uri;
        // Show loading bar
        LxProgressService.linear.show('#E1F5FE', '#progress');
        // Fetch user data
        f.nowOrWhenFetched(docURI+'*',undefined,function(ok, body, xhr) {
            LxProgressService.linear.hide('#progress');
            var thisApp = graph.statementsMatching(undefined, SOLID('homepage'), $rdf.lit($scope.app.homepage))[0];
            if (thisApp) {
                var dataSources = graph.statementsMatching(thisApp['subject'], SOLID('dataSource'), undefined);
                dataSources.forEach(function(source) {
                    $scope.my.config.workspaces.push(source['object']['value']);
                });
                $scope.initialized = true;
                $scope.saveLocalStorage();
            }
        });
    };

    /*
    $scope.ProfileElement = function(s) {
        this.locked = false;
        this.uploading = false;
        this.failed = false;
        this.picker = false;
        this.knowsme = false;
        this.statement = angular.copy(s);
        this.value = this.prev = '';
        if (s && s['object']['value']) {
            var val = s['object']['value']
            if (val.indexOf('tel:') >= 0) {
                val = val.slice(4, val.length);
            } else if (val.indexOf('mailto:') >= 0) {
                val = val.slice(7, val.length);
            }
            this.value = val;
            this.prev = val;
        }
    };

    // $scope.ProfileElement.prototype.updateSubject = function(update, force) {

    // };

    $scope.ProfileElement.prototype.updateObject = function(update, force) {
        // do not update if value hasn't changed
        if (this.value == this.prev && !force) {
          return;
        }

        $scope.changeInProgress = true;

        if (!this.failed && this.value) {
          this.prev = angular.copy(this.value);
        }
        var oldS = angular.copy(this.statement);
        if (this.statement) {
          if (this.statement['object']['termType'] == 'literal') {
            this.statement['object']['value'] = this.value;
          } else if (this.statement['object']['termType'] == 'symbol') {
            val = this.value;
            if (this.statement['predicate'].compareTerm(FOAF('mbox')) == 0) {
              val = "mailto:"+val;
            } else if (this.statement['predicate'].compareTerm(FOAF('phone')) == 0) {
              val = "tel:"+val;
            }
            this.statement['object']['uri'] = val;
            this.statement['object']['value'] = val;
          }
        }

        if (update) {
          this.locked = true;
          var query = '';
          var graphURI = '';
          if (oldS && oldS['object']['value'].length > 0) {
            var query = "DELETE DATA { " + oldS.toNT() + " }";
            if (oldS['why'] && oldS['why']['value'].length > 0) {
              graphURI = oldS['why']['value'];
            } else {
              graphURI = oldS['subject']['value'];
            }
            // add separator
            if (this.value.length > 0) {
              query += " ;\n";
            }
          }
          if (this.value && this.value.length > 0) {
            // should ask the user where the new triple should be saved
            query += "INSERT DATA { " + this.statement.toNT() + " }";
            if (graphURI.length == 0) {
              if (this.statement && this.statement['why']['value'].length > 0) {
                graphURI = this.statement['why']['value'];
              } else {
                graphURI = this.statement['subject']['value'];
              }
            }
          }

          // send PATCH request
          if (graphURI && graphURI.length > 0) {
            $scope.sendSPARQLPatch(graphURI, query, this, oldS);
          }
        }
    };

    $scope.ProfileElement.prototype.deleteSubject = function (send) {
        this.locked = true;
        $scope.changeInProgress = true;
        var query = '';
        var graphURI = '';
        var oldS = angular.copy(this.statement);
        if (oldS['why'] && oldS['why']['value'].length > 0) {
          graphURI = oldS['why']['value'];
        } else {
          graphURI = oldS['subject']['value'];
        }
        $scope.profile.sources.forEach(function (src) {
          // Delete outgoing arcs with the same subject
          var needle = oldS['object']['value'];
          var out = $scope.kb.statementsMatching($rdf.sym(needle), undefined, undefined, $rdf.sym(src.uri));
          // Also delete incoming arcs
          var inc = $scope.kb.statementsMatching(undefined, undefined, $rdf.sym(needle), $rdf.sym(src.uri));
          for (i in out) {
            var s = out[i];
            // check type?
            if (s['object'].termType == 'literal') {
              var o = $rdf.lit(s['object']['value']);
            } else if (s['object'].termType == 'symbol') {
              var o = $rdf.sym(s['object']['value']);
            }
            statement = new $rdf.st(
              s['subject'],
              s['predicate'],
              o,
              s['why']
            );
            query += 'DELETE DATA { ' + statement.toNT() + " }";
            if (i < out.length - 1 || inc.length > 0) {
              query +=  " ;\n";
            }
          };
          
          for (i in inc) {
            var s = inc[i];
            // check type?
            query += 'DELETE DATA { ' + s.toNT() + " }";
            if (i < inc.length - 1) {
              query += " ;\n";
            }
          };
        });
        // Send patch to server
        if (query.length > 0 && send) {
          $scope.sendSPARQLPatch(graphURI, query, this);
        }
        return query;
    };
    */

    // Sends SPARQL patches over the wire
    $scope.sendSPARQLPatch = function (uri, query, obj, oldStatement) {
        return new Promise(function(resolve) {
            $http({
              method: 'PATCH',
              url: uri,
              headers: {
                'Content-Type': 'application/sparql-update'
              },
              withCredentials: true,
              data: query
            }).success(function(data, status, headers) {
                if (obj) {
                    obj.locked = false;
                    obj.uploading = false;
                }
                resolve(status);
            }).error(function(data, status, headers) {
                if (obj) {
                    obj.locked = false;
                    obj.uploading = false;
                    obj.failed = true;
                    if (oldStatement) {
                        obj.statement = oldStatement;
                    }
                }
                resolve(status);
            });
        });
    };

    // LDP PUT helper function
    $scope.putLDP = function(uri, type) {
        return new Promise(function(resolve) {
            var containerURI = uri;
            var linkHeader = (type=='ldpc')?'<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"':'<http://www.w3.org/ns/ldp#Resource>; rel="type"';
            $http({
                method: 'PUT',
                url: uri,
                headers: {
                    'Content-Type': 'text/turtle',
                    'Link': linkHeader,
                },
                withCredentials: true,
                data: ''
            }).success(function(data, status, headers) {
                if (headers("Location") && headers("Location").length > 0) {
                    containerURI = headers("Location");
                }
                resolve(status);
            }).error(function(data, status, headers) {
                resolve(status);
            });
        });
    }

    // Initialize Apps workspace if user doesn't have one already
    $scope.initAppWorkspace = function() {
        console.log($scope.storageURI);
        if ($scope.storageURI.checked) {
            var uri = $scope.storageURI.checked+'Applications';
            console.log("Initializing empty apps workspace in "+uri);
            $scope.putLDP(uri, 'ldpc').then(function(status) {
                if (status == 201) {
                    if ($scope.my.config.preferencesFile) {
                        // Add new workspace triples to the preferencesFile
                        var query = "INSERT DATA { " + $scope.newStatement($rdf.sym($scope.my.webid), PIM('workspace'), $rdf.sym(uri+'/')) + " } ;\n";
                        query += "INSERT DATA { " + $scope.newStatement($rdf.sym(uri+'/'), RDF('type'), PIM('Workspace')) + " } ;\n";
                        query += "INSERT DATA { " + $scope.newStatement($rdf.sym(uri+'/'), RDF('type'), SOLID('ConfigurationWorkspace')) + " } ;\n";
                        query += "INSERT DATA { " + $scope.newStatement($rdf.sym(uri+'/'), DCT('title'), $rdf.lit("App configuration workspace")) + " }";
                        $scope.sendSPARQLPatch($scope.my.config.preferencesFile, query).then(function(result) {
                            // all done
                            $scope.my.config.appWorkspace = uri+'/';
                            $scope.saveLocalStorage();
                            $scope.notify('success', 'Created configuration workspace');
                            $scope.$apply();
                        });
                    }
                } else if (status >= 400) {
                    console.log("HTTP " + status + ": failed to create ldpc for "+uri);
                    $scope.notify('error', 'Failed to create config workspace -- HTTP '+status);
                }
            });
        }
    };

    $scope.initApp = function() {
        if ($scope.my.config.appWorkspace) {
            var selected = [];
            
            var g = new $rdf.graph();
            g.add($rdf.sym(''), RDF('type'), PIM('ConfigurationFile'));
            g.add($rdf.sym(''), SOLID('configuration'), $rdf.sym("#conf"));
            g.add($rdf.sym('#conf'), RDF('type'), SOLID('Configuration'));
            g.add($rdf.sym('#conf'), SOLID('name'), $rdf.lit($scope.app.name));
            g.add($rdf.sym('#conf'), SOLID('description'), $rdf.lit($scope.app.description));
            g.add($rdf.sym('#conf'), SOLID('homepage'), $rdf.sym($scope.app.homepage));
            g.add($rdf.sym('#conf'), SOLID('icon'), $rdf.sym($scope.app.icon));

            for (var i=0; i<$scope.my.config.availableWorkspaces.length; i++) {
                if ($scope.my.config.availableWorkspaces[i].checked) {
                    $scope.my.config.workspaces.push($scope.my.config.availableWorkspaces[i].uri);
                    g.add($rdf.sym('#conf'), SOLID('dataSource'), $rdf.sym($scope.my.config.availableWorkspaces[i].uri));
                }
            }
            var triples = new $rdf.Serializer(g).toN3(g);
            console.log(triples);
            $http({
                method: 'POST',
                url: $scope.my.config.appWorkspace,
                withCredentials: true,
                headers: {
                    "Content-Type": "text/turtle", 
                    "Slug": "contacts"
                },
                data: triples
            }).
            success(function() {
                // create containers
                $scope.notify('success', 'Created config file');
                $scope.my.toInit = $scope.my.config.workspaces.length;
                for (var i=0; i<$scope.my.config.workspaces.length; i++) {
                    $scope.initDataContainers($scope.my.config.workspaces[i]);
                }
            }).
            error(function(data, status, headers) {
                console.log('Error - '+status, data);
                $scope.notify('error', 'Failed to create config file -- HTTP '+status);
            });
        }
    };

    $scope.initDataContainers = function(workspace) {
        var uri = workspace+"Contacts";
        $scope.putLDP(uri, 'ldpc').then(function(status) {
            if (status == 201) {
                $scope.my.toInit--;
                if ($scope.my.toInit === 0) {
                    $scope.notify('success', 'Data sources created');
                    $scope.initialized = true;
                    $scope.saveLocalStorage();
                    $scope.$apply();
                }
            } else {
                // error creating containers for contacts in workspace
                $scope.notify('error', 'Failed to create LDPC -- HTTP '+status);
                console.log("HTTP " + status + ": failed to create ldpc for "+uri);
            }
        });
    };

    $scope.newStatement = function(s, p, o) {
        return new $rdf.st(s, p , o).toNT();
    };

    $scope.notify = function(type, text) {
        if (type === 'simple') {
            LxNotificationService.notify(text);
        } else if (type === 'info') {
            LxNotificationService.info(text);
        } else if (type === 'success') {
            LxNotificationService.success(text);
        } else if (type === 'warning') {
            LxNotificationService.warning(text);
        } else if (type === 'error') {
            LxNotificationService.error(text);
        }
    };

    $scope.toggleFavorite = function(id) {
        $scope.contacts[id].favorite = ($scope.contacts[id].favorite === 'favorite')?'':'favorite';
    };

    $scope.hoverContact = function(id, hover) {
        if ($scope.contacts[id].checked) {
            $scope.contacts[id].showcheckbox = true;
            $scope.contacts[id].hidepic = true;
        } else {
            if (hover) {
                $scope.contacts[id].showcheckbox = true;
                $scope.contacts[id].hidepic = true;
            } else {
                $scope.contacts[id].showcheckbox = false;
                $scope.contacts[id].hidepic = false;
            }
        }
    };

    $scope.manageSelection = function(id) {
        if ($scope.contacts[id].checked) {
            // add to selection list
            $scope.selectedContacts.push(id);
            $scope.contacts[id].showcheckbox = true;
            $scope.contacts[id].hidepic = true;
        } else {
            // remove from selection list
            for(var i = $scope.selectedContacts.length - 1; i >= 0; i--) {
                if ($scope.selectedContacts[i] === id) {
                    $scope.selectedContacts.splice(i, 1);
                    $scope.contacts[i].showcheckbox = false;
                    $scope.contacts[i].hidepic = false;
                }
            }
        }
    };

    $scope.selectAll = function() {
        $scope.selectedContacts = [];
        for (var i = $scope.contacts.length - 1; i >= 0; i--) {
           $scope.contacts[i].checked = true;
           $scope.contacts[i].showcheckbox = true;
           $scope.contacts[i].hidepic = true;
           $scope.selectedContacts.push(i);
        }
    };

    $scope.selectNone = function() {
        for (var i = $scope.contacts.length - 1; i >= 0; i--) {
           $scope.contacts[i].checked = false;
           $scope.contacts[i].showcheckbox = false;
           $scope.contacts[i].hidepic = false;
        }
        $scope.selectedContacts = [];
    };

    // Dialogues
    $scope.openDialog = function(elem) {
        LxDialogService.open(elem);
        $(document).keyup(function(e) {
          if (e.keyCode===27) {
            LxDialogService.close(elem);
          }
        });
    };

    $scope.TLSlogin = function() {
        $scope.loginTLSButtonText = 'Logging in...';
        $http({
          method: 'HEAD',
          url: "https://deiu.me/",
          withCredentials: true
        }).success(function(data, status, headers) {
          // add dir to local list
          var user = headers('User');
          if (user && user.length > 0 && user.slice(0,4) == 'http') {
            if (!$scope.webid) {
              $scope.webid = user;
            }
            $scope.getProfile(user);
            $scope.loginTLSButtonText = 'Logged in';
            $scope.loggedIn = true;
          } else {
            LxNotificationService.error('WebID-TLS authentication failed.');
            console.log('WebID-TLS authentication failed.');
            $scope.loginTLSButtonText = 'Login';
          }
        }).error(function(data, status, headers) {
            LxNotificationService.error('Could not connect to auth server: HTTP '+status);
            console.log('Could not connect to auth server: HTTP '+status);
            $scope.loginTLSButtonText = 'Login';
        });
    };

    $scope.saveLocalStorage = function() {
        var data = {
            profile: $scope.my,
            loggedIn: $scope.loggedIn
        };
        localStorage.setItem($scope.app.origin, JSON.stringify(data));
    };

    $scope.logOut = function() {
        $scope.loggedIn = false;
        $scope.webid = '';
        $scope.my = {};
        $scope.contacts = [];
        $scope.selectedContacts = [];

        // clear localstorage
        localStorage.removeItem($scope.app.origin);
    };

    // initialize by retrieving user info from sessionStorage
    // retrieve from sessionStorage
    if (localStorage.getItem($scope.app.origin)) {
        var data = JSON.parse(localStorage.getItem($scope.app.origin));
        if (data) {
            if (!$scope.my) {
              $scope.my = {};
            }
            // don't let session data become stale (24h validity)
            var dateValid = data.profile.loadDate + 1000 * 60 * 60 * 24;
            if (Date.now() < dateValid) {
                $scope.my = data.profile;
                $scope.loggedIn = true;
                if ($scope.my.config.workspaces && $scope.my.config.workspaces.length > 0) {
                    $scope.initialized = true;
                }
            } else {
                console.log("Deleting profile data because it expired");
                localStorage.removeItem($scope.app.origin);
                // prompt for login
            }
        } else {
            // clear sessionStorage in case there was a change to the data structure
            console.log("Deleting profile because of structure change");
            localStorage.removeItem($scope.app.origin);
        }
    }
});

Contacts.directive('contacts',function(){
    return {
      replace : true,
      restrict : 'E',
      templateUrl: 'app/views/contacts.tpl.html'
    }; 
});
Contacts.directive('workspaces',function(){
    return {
      replace : true,
      restrict : 'E',
      templateUrl: 'app/views/workspaces.tpl.html'
    }; 
});

