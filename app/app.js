var PROXY = "https://rww.io/proxy.php?uri={uri}";
var TIMEOUT = 90000;
var DEBUG = true;
// Namespaces
var RDF = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
var RDFS = $rdf.Namespace("http://www.w3.org/2000/01/rdf-schema#");
var FOAF = $rdf.Namespace("http://xmlns.com/foaf/0.1/");
var OWL = $rdf.Namespace("http://www.w3.org/2002/07/owl#");
var SPACE = $rdf.Namespace("http://www.w3.org/ns/pim/space#");
var UI = $rdf.Namespace("http://www.w3.org/ns/ui#");
var DCT = $rdf.Namespace("http://purl.org/dc/terms/");
var CERT = $rdf.Namespace("http://www.w3.org/ns/auth/cert#");
var ACL = $rdf.Namespace("http://www.w3.org/ns/auth/acl#");

$rdf.Fetcher.crossSiteProxyTemplate=PROXY;

var Contacts = angular.module('Contacts', ['lumx']);


Contacts.controller('Main', function($scope, $http, $sce, LxNotificationService, LxProgressService, LxDialogService) {
    $scope.loggedIn = false;
    $scope.loginTLSButtonText = "Login";

    $scope.appOrigin = window.location.origin;
    $scope.loginWidget = $sce.trustAsResourceUrl('https://linkeddata.github.io/signup/index.html?ref='+$scope.appOrigin);

    $scope.my = {
        name: "Andrei Vlad Sambra",
        email: "andrei@w3.org",
        picture: "https://deiu.me/public/avatar.jpg"
    };

    $scope.selectedContacts = [];

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

    $scope.getProfile = function(webid, forWebid, mine) {
        // LxProgressService.linear.show('#E1F5FE', '#progress');
    };

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

    $scope.sendSPARQLPatch = function (uri, query, obj, oldStatement) {
    $http({
      method: 'PATCH',
      url: uri,
      headers: {
        'Content-Type': 'application/sparql-update'
      },
      withCredentials: true,
      data: query
    }).success(function(data, status, headers) {
      obj.locked = false;
      obj.uploading = false;
      $scope.changeInProgress = false;
      Notifier.success('Profile updated!');
    }).error(function(data, status, headers) {
      obj.locked = false;
      obj.uploading = false;
      obj.failed = true;
      if (oldStatement) {
        obj.statement = oldStatement;
      }
      $scope.changeInProgress = false;
      Notifier.error('Could not update profile: HTTP '+status);
      console.log(data);
    });
    };

    // Load a user's profile
    // string uri  - URI of resource containing profile information
    // bool authenticated - whether the user was previously authenticated or now
    // string forWebID - whether it loads extended profile documents for a given WebID
    $scope.getProfile = function(uri, authenticated, redirect, forWebID) {
        // LxProgressService.linear.show('#E1F5FE', '#progress');
        if (!$scope.profiles) {
          $scope.profiles = [];
        }

        var webid = (forWebID)?forWebID:uri;

        if (!$scope.profiles[webid]) {
            $scope.profiles[webid] = {};
        }
        if (!$scope.profiles[webid].webid || $scope.profiles[webid].webid.length == 0) {
            $scope.profiles[webid].webid = webid;
        }

        var g = $rdf.graph();
        var f = $rdf.fetcher(g, TIMEOUT);

        var docURI = (uri.indexOf('#') >= 0)?uri.slice(0, uri.indexOf('#')):uri;
        var webidRes = $rdf.sym(webid);
        $scope.profiles[webid].loading = true;
        if (authenticated) {
            $scope.authenticated = webid;
        }
        // fetch user data
        f.nowOrWhenFetched(docURI,undefined,function(ok, body, xhr) {
            if (!ok) {
                console.log('Warning - profile not found.');
                var extra = '';
                if (forWebID) {
                    extra = 'additional';
                }
                console.log('Failed to fetch '+extra+' profile '+uri+'. HTTP '+xhr.status);
                if (!$scope.profiles[webid].fullname) {
                    $scope.profiles[webid].fullname = webid;
                }
                $scope.profiles[webid].loading = false;
                $scope.loginTLSButtonText = "With certificate";
                $scope.$apply();
                // return promise
                // reject(ok, body, xhr);
            } else {
                if (xhr && xhr.getResponseHeader('User') && xhr.getResponseHeader('User') == uri) {
                    $scope.authenticated = uri;
                }
                // set time of loading
                if (!$scope.profiles[webid].date) {
                    $scope.profiles[webid].date = Date.now();
                }
                // save docURI to list of sources
                var docName = g.statementsMatching($rdf.sym(docURI), DCT('title'), undefined)[0];
                if (docName) {
                    docName = docName['object']['value'];
                } else {
                    docName = docURI;
                }
                // add to list of profile documents if it's an writable resource
                // (i.e. it's an LDP resource)
                if (!$scope.profiles[webid].sources) {
                    $scope.profiles[webid].sources = [];
                }
                if (xhr.getResponseHeader('Link')) {
                    var lh = parseLinkHeader(xhr.getResponseHeader('Link'));
                    if (lh['type'] && lh['type'].indexOf('http://www.w3.org/ns/ldp#Resource') >= 0 && 
                        $scope.profiles[webid].sources.indexOf(docURI) < 0) {
                        $scope.profiles[webid].sources.push({uri: docURI, name: docName, loaded: false});
                    }
                }

                // try to fetch additional data from sameAs, seeAlso and preferenceFile
                if (!forWebID) {
                    var sameAs = g.statementsMatching(webidRes, OWL('sameAs'), undefined);
                    if (sameAs.length > 0) {
                        sameAs.forEach(function(same){
                            $scope.getProfile(same['object']['value'], false, false, webid);
                        });
                    }
                    var seeAlso = g.statementsMatching(webidRes, OWL('seeAlso'), undefined);
                    if (seeAlso.length > 0) {
                        seeAlso.forEach(function(see){
                            $scope.getProfile(see['object']['value'], false, false, webid);
                        });
                    }
                    var prefs = g.statementsMatching(webidRes, SPACE('preferencesFile'), undefined);
                    if (prefs.length > 0) {
                        prefs.forEach(function(pref){
                            if (pref['object']['value']) {
                                $scope.getProfile(pref['object']['value'], false, false, webid);
                            }
                        });
                    }
                    $scope.profiles[webid].toLoad = sameAs.length + seeAlso.length + prefs.length + 1;
                }

                // get the user's Key Store URI
                if (!$scope.profiles[webid].keystore || $scope.profiles[webid].keystore.value.length == 0) {
                    var keystore = g.statementsMatching(webidRes, ACL('keystore'), undefined)[0];
                    if (!keystore || keystore['object']['value'].length == 0) {
                        keystore = $rdf.st(webidRes, ACL('keystore'), $rdf.lit(''), $rdf.sym(''));
                    }
                    $scope.profiles[webid].keystore = new $scope.ProfileElement(keystore);
                }

                // get info
                if (!$scope.profiles[webid].fullname || $scope.profiles[webid].fullname.value.length == 0) {
                    var fullname = g.statementsMatching(webidRes, FOAF('name'), undefined)[0];
                    if (!fullname || fullname['object']['value'].length == 0) {
                        fullname = $rdf.st(webidRes, FOAF('name'), $rdf.lit(''), $rdf.sym(''));
                    }
                    $scope.profiles[webid].fullname = new $scope.ProfileElement(fullname);
                }
                // Firstname
                if (!$scope.profiles[webid].firstname || $scope.profiles[webid].firstname.value.length == 0) {
                    var firstname = g.statementsMatching(webidRes, FOAF('givenName'), undefined)[0];
                    if (!firstname || firstname['object']['value'].length == 0) {
                        firstname = $rdf.st(webidRes, FOAF('givenName'), $rdf.lit(''), $rdf.sym(''));
                    }
                    $scope.profiles[webid].firstname = new $scope.ProfileElement(firstname);
                }
                // Lastname
                if (!$scope.profiles[webid].lastname || $scope.profiles[webid].lastname.value.length == 0) {
                    var lastname = g.statementsMatching(webidRes, FOAF('familyName'), undefined)[0];
                    if (!lastname || lastname['object']['value'].length == 0) {
                        lastname = $rdf.st(webidRes, FOAF('familyName'), $rdf.lit(''), $rdf.sym(''));
                    }
                    $scope.profiles[webid].lastname = new $scope.ProfileElement(lastname);
                }
                // Nickname
                if (!$scope.profiles[webid].nick || $scope.profiles[webid].nick.value.length == 0) {
                    var nick = g.statementsMatching(webidRes, FOAF('nick'), undefined)[0];
                    if (!nick || nick['object']['value'].length == 0) {
                        nick = $rdf.st(webidRes, FOAF('nick'), $rdf.lit(''), $rdf.sym(''));
                    }
                    $scope.profiles[webid].nick = new $scope.ProfileElement(nick);
                }
                // Gender
                if (!$scope.profiles[webid].gender || $scope.profiles[webid].gender.value.length == 0) {
                    var gender = g.statementsMatching(webidRes, FOAF('gender'), undefined)[0];
                    if (!gender || gender['object']['value'].length == 0) {
                        gender = $rdf.st(webidRes, FOAF('gender'), $rdf.lit(''), $rdf.sym(''));
                    }
                    $scope.profiles[webid].gender = new $scope.ProfileElement(gender);
                }

                // Get profile picture
                if (!$scope.profiles[webid].picture || $scope.profiles[webid].picture.value.length == 0) {
                    var img = g.statementsMatching(webidRes, FOAF('img'), undefined)[0];
                    var pic;
                    if (img) {
                        pic = img;
                    } else {
                        // check if profile uses depic instead
                        var depic = g.statementsMatching(webidRes, FOAF('depiction'), undefined)[0];  
                        if (depic) {
                            pic = depic;
                        }
                    }
                    if (!pic || pic['object']['value'].length == 0) {
                        pic = $rdf.st(webidRes, FOAF('img'), $rdf.sym(''), $rdf.sym(''));
                    }
                    $scope.profiles[webid].picture = new $scope.ProfileElement(pic);
                }

                // Background image
                if (!$scope.profiles[webid].bgpicture || $scope.profiles[webid].bgpicture.value.length == 0) {
                    var bgpic = g.statementsMatching(webidRes, UI('backgroundImage'), undefined)[0];
                    if (!bgpic || bgpic['object']['value'].length == 0) {
                        bgpic = $rdf.st(webidRes, UI('backgroundImage'), $rdf.sym(''), $rdf.sym(''));
                    }
                    $scope.profiles[webid].bgpicture = new $scope.ProfileElement(bgpic);
                }

                // Phones
                if (!$scope.profiles[webid].phones) {
                    $scope.profiles[webid].phones = [];
                }
                var phones = g.statementsMatching(webidRes, FOAF('phone'), undefined);
                if (phones.length > 0) {
                    phones.forEach(function(phone){
                        $scope.profiles[webid].phones.push(new $scope.ProfileElement(phone));
                    });
                }

                // Emails
                if (!$scope.profiles[webid].emails) {
                    $scope.profiles[webid].emails = [];
                }
                var emails = g.statementsMatching(webidRes, FOAF('mbox'), undefined);
                if (emails.length > 0) {
                    emails.forEach(function(email){
                        $scope.profiles[webid].emails.push(new $scope.ProfileElement(email));
                    });
                }

                // Homepages
                if (!$scope.profiles[webid].homepages) {
                    $scope.profiles[webid].homepages = [];
                }
                var homepages = g.statementsMatching(webidRes, FOAF('homepage'), undefined);
                if (homepages.length > 0) {
                    homepages.forEach(function(homepage){
                          $scope.profiles[webid].homepages.push(new $scope.ProfileElement(homepage));
                    });
                }

                $scope.profiles[webid].toLoad--;
                console.log("Profiles left to load for "+webid+": "+$scope.profiles[webid].toLoad);
                $scope.profiles[webid].sources.forEach(function(src) {
                    if (src.uri === docURI) {
                        src.loaded = true;
                    }
                });

                $scope.profiles[webid].loading = false;

                if ($scope.authenticated == webid) {
                    $scope.profile = $scope.profiles[webid];
                    __profile = $scope.profile;
                    $scope.saveCredentials($scope.authenticated);
                }
                $scope.$apply();

                // debug
                if (authenticated) {
                    $scope.loginTLSButtonText = "With certificate";
                    var authUser = ($scope.profiles[webid].fullname.value)?" as "+$scope.profiles[webid].fullname.value:"";  
                    Notifier.success('Authenticated'+authUser);
                    $scope.saveCredentials($scope.authenticated, redirect);
                }
            }
        });
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
          url: "https://rww.io/",
          withCredentials: true
        }).success(function(data, status, headers) {
          // add dir to local list
          var user = headers('User');
          if (user && user.length > 0 && user.slice(0,4) == 'http') {
            if (!$scope.webid) {
              $scope.webid = user;
            }
            $scope.getProfile(user, null, true);
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

    $scope.saveCredentials = function (uri, redirect) {
        var app = {
            profile: { 
                webid: $scope.webid,
                date: $scope.date
            },
            loggedIn: $scope.loggedIn
        };
        localStorage.setItem($scope.appOrigin, JSON.stringify(app));
    };

    $scope.logOut = function() {
        $scope.loggedIn = false;
        $scope.webid = '';
        $scope.my = {};
        $scope.contacts = [];
        $scope.selectedContacts = [];

        // clear localstorage
        localStorage.removeItem($scope.appOrigin);
    };

    // initialize by retrieving user info from sessionStorage
    // retrieve from sessionStorage
    if (localStorage.getItem($scope.appuri)) {
        var app = JSON.parse(localStorage.getItem($scope.appOrigin));
        if (app) {
            if (!$scope.my) {
              $scope.my = {};
            }
            // don't let session data become stale (24h validity)
            var dateValid = app.profile.date + 1000 * 60 * 60 * 24;
            if (Date.now() < dateValid) {
                $scope.my = app.profile;
                if (!$scope.webid) {
                    $scope.webid = app.profile.webid;
                }
                $scope.loggedIn = app.loggedIn;
                // $scope.getProfile(app.profile.webid);
            } else {
                console.log("Deleting profile because it expired");
                localStorage.removeItem($scope.appOrigin);
            }
        } else {
            // clear sessionStorage in case there was a change to the data structure
            console.log("Deleting profile because of structure change");
            localStorage.removeItem($scope.appOrigin);
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
Contacts.directive('addDialogue',function(){
    return {
      replace : true,
      restrict : 'E',
      templateUrl: 'app/views/addDialogue.tpl.html'
    }; 
});

