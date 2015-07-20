'use strict';

/**
    Missing VCARD terms:
    class: VCard, AddressBook
    property: hasWebID

*/

var AUTHENDPOINT = "https://databox.me/";
var PROXY = "https://rww.io/proxy.php?uri={uri}";
var TIMEOUT = 5000;
var DEBUG = true;
// Namespaces
var RDF = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
var RDFS = $rdf.Namespace("http://www.w3.org/2000/01/rdf-schema#");
var FOAF = $rdf.Namespace("http://xmlns.com/foaf/0.1/");
var OWL = $rdf.Namespace("http://www.w3.org/2002/07/owl#");
var PIM = $rdf.Namespace("http://www.w3.org/ns/pim/space#");
var UI = $rdf.Namespace("http://www.w3.org/ns/ui#");
var DCT = $rdf.Namespace("http://purl.org/dc/terms/");
var LDP = $rdf.Namespace("http://www.w3.org/ns/ldp#");
var SOLID = $rdf.Namespace("http://www.w3.org/ns/solid/app#");
var VCARD = $rdf.Namespace("http://www.w3.org/2006/vcard/ns#");
var FAV = $rdf.Namespace("http://www.eclap.eu/schema/eclap/");

var scope = {};
var gg;

$rdf.Fetcher.crossSiteProxyTemplate = PROXY;

var App = angular.module('Contacts', [
    'ui.filters',
    'lumx',
    'angularFileUpload',
    'ngImgCrop'
]);

App.filter('filterBy', ['$parse', function ($parse) {
    return function (collection, property, search) {
        var prop, getter;

        function hasPattern(word, pattern) {
            if (pattern === '') {
                return word;
            }
            if (word.indexOf(pattern) === -1) {
                return false;
            }
        }
        function toArray(object) {
            return angular.isArray(object) ? object : Object.keys(object).map(function (key) {
                return object[key];
            });
        }

        if (search === '') {
            return collection;
        } else if (search && search.length < 2) {
            return collection;
        }

        collection = (angular.isObject(collection)) ? toArray(collection) : collection;

        if (!angular.isArray(collection) || angular.isUndefined(property)
                || angular.isUndefined(search)) {
            return collection;
        }

        getter = $parse('value');

        return collection.filter(function (elm) {
            search = search.toLowerCase();
            var results = property.map(function (property) {
                var i, item;
                for (i in elm[property]) {
                    item = elm[property][i];
                    prop = getter(item);
                    if (!angular.isString(prop)) {
                        return false;
                    }
                    prop = prop.toLowerCase();
                    return prop;
                }
            }).join(' ');
            return hasPattern(results, search) !== false;
        });
    };
}]);

App.filter('toProfileViewer', function() {
  return function(string) {
    return 'https://linkeddata.github.io/profile-editor/#/profile/view?webid='+encodeURIComponent(string);
  };
});

App.controller('Main', function ($scope, $http, $timeout, $window, $location, LxNotificationService, LxDialogService) {
    $scope.app = {};
    $scope.app.origin = window.location.origin;
    $scope.app.homepage = "https://linkeddata.github.io/contacts/";
    $scope.app.icon = "https://linkeddata.github.io/contacts/images/favicon.png";
    $scope.app.name = "Contacts";
    $scope.app.description = "A personal address book manager";

    $scope.originalImage = undefined;
    $scope.croppedImage = '';

    // map of vocabularies used for vcard data
    $scope.vcardElems = [
        { name: 'fn', label: 'Full name', icon: 'account', type: 'text', link: false, textarea: false, display: true, unique: true },
        { name: 'hasWebID', label: 'WebID', icon: 'web', type: 'url', link: true, textarea: false, display: true, unique: true },
        { name: 'hasPhoto', label: 'Photo', icon: 'camera', link: true, textarea: false, display: false, unique: true },
        { name: 'hasEmail', label: 'Email', icon: 'email', type: 'email', prefixURI: 'mailto:', link: true, textarea: false, display: true, unique: false},
        { name: 'hasTelephone', label: 'Phone', icon: 'phone', type: 'tel', prefixURI: 'tel:', link: true, textarea: false, display: true, unique: false},
        { name: 'hasURL', label: 'URL', icon: 'link', type: 'url', link: true, textarea: false, display: true, unique: false},
        { name: 'hasNote', label: 'Note', icon: 'file-document', link: false, textarea: true, display: true, unique: true },
        { name: 'hasFavorite', label: 'Favorite', icon: 'star-outline', link: true, textarea: false, display: false, unique: true }
    ];
    $scope.vcardElems.isUnique = function (name) {
        var elem, i = 0;
        for (i; i < $scope.vcardElems.length; i++) {
            elem = $scope.vcardElems[i];
            if (elem.name === name && elem.unique === true) {
                return true;
            }
        }
        return false;
    };

    // set init variables
    $scope.init = function () {
        $scope.loggedIn = false;
        $scope.initialized = true;
        $scope.loginTLSButtonText = "Login";
        // display elements object
        $scope.show = {
            contact: false,
            topbar: true,
            list: true
        };

        // search filter object
        $scope.filters = {};

        $scope.selects = {
            contacts: []
        };

        // user model
        $scope.my = {
            config: {}
        };

        // chosen storage URI for the app workspace
        $scope.storageURI = {};
        // temporary list of selected contacts

        // contact to be added/updated
        $scope.contact = {};

        // list of contacts
        $scope.contacts = {};
    };

    $scope.connectToSocket = function(uri) {
        var parser = document.createElement('a');
        parser.href = uri;
        parser.host; // => "example.com"
        parser.pathname; // => "/pathname/"

        var wss = 'wss://'+parser.host;
        wss += parser.pathname;

        var socket = new WebSocket(wss);
        socket.onopen = function(){
            this.send('sub ' + uri);
        }
        socket.onmessage = function(msg){
            if (msg.data && msg.data.slice(0, 3) === 'pub') {
                // resource updated
                $scope.loadContacts(uri, true);
            }
        }
        socket.onclose = function() {
            console.log("Websocket connection closed. Restarting...");
            $scope.connectToSocket(uri);
        }
        if (!$scope.webSockets) {
            $scope.webSockets = {};
        }
        $scope.webSockets[uri] = socket;
    };

    $scope.setupWebSockets = function() {
        if (!$scope.socketsStarted && $scope.my.config.datasources && $scope.my.config.datasources.length > 0) {
            for (var i in $scope.my.config.datasources) {
                var uri = $scope.my.config.datasources[i].uri;
                if (uri && uri.length > 0) {
                    $scope.connectToSocket(uri);
                }
            }
            $scope.socketsStarted = true;
        }
    };

    // Contact element object
    $scope.ContactElement = function (s, exists) {
        var val, element = {};
        element.failed = false;
        element.value = '';
        element.prev = '';
        element.statement = s;
        if (s && s.object.value) {
            val = decodeURIComponent(s.object.value);
            if (val.indexOf('tel:') >= 0) {
                val = val.slice(4, val.length);
            } else if (val.indexOf('mailto:') >= 0) {
                val = val.slice(7, val.length);
            }
            element.value = val;
            element.prev = (exists) ? val : '';
        }
        return element;
    };

    $scope.focusElement = function (id) {
        $timeout(function () {
            angular.element('#' + id.toString()).focus();
        }, 0);
    };

    $scope.addContactField = function (name) {
        if ($scope.contact[name] && $scope.contact[name].length > 0 && $scope.vcardElems.isUnique(name)) {
            if ($scope.contact[name][0].hidden) {
                $scope.contact[name][0].hidden = false;
                // focus new element
                $scope.focusElement(name + '0');
            }
            return;
        }
        var field, pos, statement = new $rdf.st(
            $rdf.sym($scope.contact.uri),
            VCARD(name),
            $rdf.sym(''),
            $rdf.sym('')
        );
        if (!$scope.contact[name]) {
            $scope.contact[name] = [];
        }
        field = $scope.ContactElement(statement);
        $scope.contact[name].push(field);
        pos = $scope.contact[name].length - 1;
        // focus new element
        $scope.focusElement(name + pos);
    };

    $scope.deleteContactField = function (elem, item) {
        $scope.contact[elem][item].value = '';
        $scope.contact[elem][item].hidden = true;
    };

    $scope.showContactInformation = function (action) {
        if (!action) {
            action = 'view';
        }
        $location.path('/contacts/'+action).search({ uri: $scope.contact.uri }).replace();
        $scope.show.posClass = 'slide-in';
        $scope.show.contact = true;
        $scope.show.list = false;
        $scope.show.topbar = false;
        // scroll to top
        window.scrollTo(0, 0);
    };

    $scope.hideContactInformation = function () {
        if ($scope.contact.editing) {
            $scope.contact.editing = false;
        }
        $location.path('/').search({}).replace();
        $scope.show.posClass = 'slide-out';
        $scope.show.contact = false;
        $scope.show.list = true;
        $scope.show.topbar = true;
    };

    $scope.viewContact = function (uri) {
        if ($scope.contacts[uri]) {
            delete $scope.contact;
            $scope.contact = angular.copy($scope.contacts[uri]);
            $scope.contact.editing = false;
            $scope.showContactInformation('view');
        }
    };

    $scope.editContact = function (uri) {
        delete $scope.contact;
        if (uri !== undefined) {
            $scope.contact = angular.copy($scope.contacts[uri]);
        } else {
            $scope.resetContact();
        }
        $scope.contact.editing = true;
        $scope.showContactInformation('edit');
    };

    $scope.saveContact = function (force) {
        // contact exists => patching it
        if ($scope.contact.uri !== undefined) {
            var query = $scope.updateContact($scope.contact, force).then(function (status) {
                if (status === -1) {
                    $scope.notify('error', 'Failed to update contact', status);
                } else if (status >= 200 && status < 400) {
                    var uri;
                    for (uri in $scope.contacts) {
                        if (uri === $scope.contact.uri) {
                            delete $scope.contact.pictureFile;
                            $scope.contacts[uri] = angular.copy($scope.contact);
                        }
                    }
                    $scope.saveLocalStorage();
                    $scope.notify('success', 'Contact updated');
                    $scope.hideContactInformation();
                    $scope.selectNone();
                    $scope.$apply();
                } else {
                    $scope.notify('error', 'Failed to update contact -- HTTP', status);
                }
            });
        } else {
            // writing new contact
            var triples, g = new $rdf.graph();
            g.add($rdf.sym(''), RDF('type'), VCARD('VCard'));
            g.add($rdf.sym(''), VCARD('hasIndividual'), $rdf.sym('#card')); // hasIndividual doesn't exist!
            g.add($rdf.sym('#card'), RDF('type'), VCARD('Individual'));
            $scope.vcardElems.forEach(function (elem) {
                if ($scope.contact[elem.name] && $scope.contact[elem.name].length > 0) {
                    $scope.contact[elem.name].forEach(function (item) {
                        if (item.value.length > 0) {
                            var object, value = (elem.prefixURI) ? elem.prefixURI + item.value : item.value;
                            if (elem.link) {
                                object = $rdf.sym(value);
                            } else {
                                object = $rdf.lit(value);
                            }
                            g.add($rdf.sym('#card'), VCARD(elem.name), object);
                        } else {
                            delete $scope.contact[elem.name];
                        }
                    });
                }
            });

            triples = new $rdf.Serializer(g).toN3(g);

            $http({
                method: 'POST',
                url: $scope.contact.datasource.uri,
                withCredentials: true,
                headers: {
                    "Content-Type": "text/turtle"
                },
                data: triples
            }).
                success(function (data, status, headers) {
                    if (headers('Location')) {
                        $scope.contact.uri = headers('Location') + "#card";
                        delete $scope.contact.pictureFile;
                        $scope.contacts[$scope.contact.uri] = angular.copy($scope.contact);
                        $scope.hideContactInformation();
                        $scope.saveLocalStorage();
                        $scope.notify('success', 'Contact added');
                    }
                }).
                error(function (data, status, headers) {
                    console.log('Error saving contact on sever - ' + status, data);
                    $scope.notify('error', 'Failed to write contact to server -- HTTP ' + status);
                });
        }
    };

    $scope.resetContact = function () {
        delete $scope.contact;
        $scope.contact = {};
        $scope.contact.pictureFile = {};
        $scope.contact.editing = true;
        $scope.contact.datasource = $scope.my.config.datasources[0];
        $scope.vcardElems.forEach(function (elem) {
            var statement = new $rdf.st(
                $rdf.sym(''),
                VCARD(elem.name),
                $rdf.sym(''),
                $rdf.sym('')
            );
            $scope.contact[elem.name] = [ $scope.ContactElement(statement) ];
        });
    };

    $scope.confirmDelete = function (ids) {
        var plural, id, text;
        if (ids.length === 1) {
            plural = '';
            id = ids[0];
            text = $scope.contacts[id].fn[0].value + ' ?';
        } else if (ids.length > 1) {
            plural = 's';
            text = ids.length + ' contacts?';
        }
        LxNotificationService.confirm('Delete contact' + plural + '?', 'Are you sure you want to delete ' + text, { ok: 'Delete', cancel: 'Cancel'}, function (answer) {
            if (answer === true) {
                $scope.deleteContacts(ids);
            }
        });
    };

    $scope.deleteContacts = function (ids) {
        if (!ids || ids.length === 0) {
            return;
        }

        function deleteContact(uri) {
            $http({
                method: 'DELETE',
                url: uri,
                withCredentials: true
            }).
                success(function (data, status, headers) {
                    delete $scope.contacts[uri];
                    $scope.notify('success', 'Contact deleted');
                     // save modified contacts list
                    $scope.saveLocalStorage();
                }).
                error(function (data, status) {
                    if (status === 404) {
                        delete $scope.contacts[uri];
                        $scope.saveLocalStorage();
                        $scope.notify('success', 'Contact deleted');
                        console.log($scope.contacts);
                    } else if (status === 401) {
                        $scope.notify('error', 'Failed to delete contact from server -- HTTP ' + status);
                        console.log('Forbidden', 'Authentication required to delete ' + uri);
                    } else if (status === 403) {
                        $scope.notify('error', 'Failed to delete contact from server -- HTTP ' + status);
                        console.log('Forbidden', 'You are not allowed to delete ' + uri);
                    } else if (status === 409) {
                        $scope.notify('error', 'Failed to delete contact from server -- HTTP ' + status);
                        console.log('Failed', 'Conflict detected. In case of directory, check if not empty.');
                    } else {
                        $scope.notify('error', 'Failed to delete contact from server -- HTTP ' + status);
                        console.log('Failed '+status, data);
                    }
                });
        };

        for (var i in ids) {
            deleteContact(ids[i]);
        }
        // hide select bar
        $scope.selectNone();
    };

    $scope.confirmMerge = function(ids) {
        LxNotificationService.confirm('Merge contacts?', 'Are you sure you want to merge the selected contacts?',
                                      { ok: 'Merge', cancel: 'Cancel'}, function(answer) {
            if (answer === true) {
                $scope.mergeContacts(ids);
            }
        });
    };

    $scope.mergeContacts = function(ids) {
        if (!ids || ids.length === 0) {
            return;
        }
        // merge function
        var merge = function(obj2) {
            // first set the URI if it doesn't exist
            if (!$scope.contact.uri) {
                $scope.contact.uri = obj2.uri;
            }
            // add existing properties from obj2
            for (p in obj2) {
                if (obj2.hasOwnProperty(p)) {
                    if (Object.prototype.toString.call(obj2[p]) === "[object Array]") {
                        for (var i in obj2[p]) {
                            if (!$scope.contact[p]) {
                                $scope.contact[p] = [];
                            }
                            var uniq = $scope.vcardElems.isUnique(p);
                            // if (uniq && $scope.contact[p].length > 0) {
                            //     break;
                            // }
                            var prop = obj2[p][i];
                            if (prop.value && prop.value.length > 0) {
                                // iterate over first object props
                                if ($scope.contact[p].length > 0) {
                                    for (e in $scope.contact[p]) {
                                        // add only new values
                                        if (uniq && $scope.contact[p][e] && $scope.contact[p][e].value.length < prop.value.length) {
                                            $scope.contact[p][e].prev = angular.copy($scope.contact[p][e].value);
                                            $scope.contact[p][e].value = prop.value;
                                        } else if (!uniq && $scope.contact[p][e] && $scope.contact[p][e].value !== prop.value) {
                                            var statement = new $rdf.st(
                                                    $rdf.sym($scope.contact.uri),
                                                    VCARD(p),
                                                    $rdf.sym(prop.value),
                                                    $rdf.sym($scope.contact.uri)
                                                );
                                            var newElem = $scope.ContactElement(statement);
                                            $scope.contact[p].push(newElem);
                                        }
                                    }
                                } else {
                                    var statement = new $rdf.st(
                                            $rdf.sym($scope.contact.uri),
                                            VCARD(p),
                                            $rdf.sym(prop.value),
                                            $rdf.sym($scope.contact.uri)
                                        );
                                    var newElem = $scope.ContactElement(statement);
                                    $scope.contact[p].push(newElem);
                                }
                            }
                        }
                    } else {
                        // copy new props from obj2
                        if (!$scope.contact[p]) {
                            $scope.contact[p] = obj2[p];
                        }
                    }
                }
            }
        };

        $scope.contact = {};
        for (var i in ids) {
            merge($scope.contacts[ids[i]]);
        }
        $scope.saveContact(true);

        var toDelete = [];
        for (var i=0; i<ids.length; i++) {
            if (ids[i] !== $scope.contact.uri) {
                toDelete.push(ids[i]);
            }
        }
        $scope.deleteContacts(toDelete);
    };

    $scope.selectDatasource = function(ds) {
        $scope.contact.datasource = $scope.selects.datasource = ds;
    };

    //// IMAGE HANDLING
    // select file for picture
    $scope.handleFileSelect = function(file) {
        if (file) {
            LxDialogService.open('picture-cropper');
            $scope.originalImage = undefined;
            $scope.croppedImage = {value: ''};
            $scope.imageType = file.type;
            var reader = new FileReader();
            reader.onload = function (evt) {
                $scope.$apply(function($scope){
                    $scope.originalImage=evt.target.result;
                });
            };
            reader.readAsDataURL(file);
        }
    };

    $scope.dataURItoBlob = function(dataURI) {
        var data = dataURI.split(',')[1];
        // var binary = atob(data);
        var binary;
        if (dataURI.split(',')[0].indexOf('base64') >= 0)
            binary = atob(data);
        else
            binary = decodeURI(data);

        var buffer = new ArrayBuffer(binary.length);
        var ia = new Uint8Array(buffer);
        for (var i = 0; i < binary.length; i++) {
            ia[i] = binary.charCodeAt(i);
        }
        var blob = new Blob([ia], {type: $scope.imageType});

        return blob;
        // new File() is not supported by Safari for now
        // return new File([blob.buffer], $scope.pictureName, {
        //   lastModified: new Date(0),
        //   type: $scope.imageType
        // });
    };

    $scope.$watch('contact.pictureFile.file', function (newFile, oldFile) {
        if (newFile !== undefined) {
            $scope.originalImage = undefined;
            $scope.croppedImage = {value: ''};
            $scope.handleFileSelect(newFile[0]);
        }
    });

    $scope.savePicture = function() {
        if (!$scope.contact.hasPhoto) {
            $scope.contact.hasPhoto = [
                $scope.ContactElement(
                    new $rdf.st($rdf.sym($scope.contact.uri), VCARD('hasPhoto'), $rdf.sym(''), $rdf.sym(''))
            )];
        }
        $scope.contact.hasPhoto[0].value = angular.copy($scope.croppedImage.value);
        $scope.originalImage = undefined;
        $scope.croppedImage = {value: ''};

        LxDialogService.close('picture-cropper');
    };

    // Load a user's profile
    // string uri  - URI of resource containing profile information
    // string forWebID - whether it loads extended profile documents for a given WebID
    $scope.getProfile = function(uri, forWebID) {
        var webid = (forWebID)?forWebID:uri;

        if (!$scope.my.webid || $scope.my.webid.length == 0) {
            $scope.my.webid = webid;
        }

        if (!$scope.my.config) {
            $scope.my.config = {};
        }

        var g = new $rdf.graph();
        var f = new $rdf.fetcher(g, TIMEOUT);

        var docURI = (uri.indexOf('#') >= 0)?uri.slice(0, uri.indexOf('#')):uri;
        var webidRes = $rdf.sym(webid);
        // Show loading bar
        $scope.loadingText = "...Loading profile";
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
                            $scope.getProfile(same.object.value, webid);
                        });
                    }
                    var seeAlso = g.statementsMatching(webidRes, OWL('seeAlso'), undefined);
                    if (seeAlso.length > 0) {
                        seeAlso.forEach(function(see){
                            $scope.getProfile(see.object.value, webid);
                        });
                    }
                    var prefs = g.statementsMatching(webidRes, PIM('preferencesFile'), undefined);
                    if (prefs.length > 0) {
                        if (prefs[0].object.value) {
                            $scope.getProfile(prefs[0].object.value, webid);
                            $scope.my.config.preferencesFile = prefs[0].object.value;
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
                                    uri: storages[i].object.value,
                                    checked: (i===0)?true:false
                                }
                            );
                        }
                    }
                }

                // Get workspaces
                if (!$scope.my.config.availableWorkspaces || $scope.my.config.availableWorkspaces.length === 0) {
                    $scope.my.config.availableWorkspaces = [];
                    var workspaces = g.statementsMatching(webidRes, PIM('workspace'), undefined);
                    if (workspaces && workspaces.length > 0) {
                        for (var i=0; i<workspaces.length; i++) {
                            var ws = workspaces[i];
                            // don't include the apps workspace in the suggestions list
                            if (g.statementsMatching(ws.object, RDF('type'), PIM('PreferencesWorkspace'))[0]) {
                                continue;
                            }
                            var wsTitle = g.any(ws.object, DCT('title'));
                            if (!$scope.my.config.availableWorkspaces) {
                                $scope.my.config.availableWorkspaces = [];
                            }
                            $scope.my.config.availableWorkspaces.push({
                                uri: ws.object.value,
                                name: (wsTitle)?wsTitle.value:'Untitled workspace'
                            });
                        };
                        // check if user has an app config workspace
                        var configWs = g.statementsMatching(undefined, RDF('type'), PIM('PreferencesWorkspace'))[0];
                        if (configWs) {
                            $scope.my.config.appWorkspace = configWs.subject.value;
                            // Also get app data config
                            $scope.fetchAppConfig();
                        } else {
                            $scope.initialized = false;
                        }
                    } else {
                        //@@TODO no workspaces found
                        // write to a container in storage?
                    }
                }

                // decrease the counter of profiles left to load
                $scope.my.toLoad--;

                if ($scope.my.toLoad === 0) {
                    $scope.saveLocalStorage();
                }

                $scope.$apply();
            }
        });
    };

    // Fetch and look for our app in configuration resources
    $scope.fetchAppConfig = function() {
        var g = new $rdf.graph();
        var f = new $rdf.fetcher(g, TIMEOUT);

        // Show loading bar
        if ($scope.my.config.appWorkspace) {
            // Fetch user data
            f.nowOrWhenFetched($scope.my.config.appWorkspace+'*',undefined,function(ok, body, xhr) {
                $scope.loadingText = "...Loading app config";
                if (!$scope.my.config.datasources) {
                    $scope.my.config.datasources = [];
                }
                var thisApp = g.statementsMatching(undefined, SOLID('homepage'), $rdf.sym($scope.app.homepage))[0];
                if (thisApp) {
                    $scope.my.config.appConfigURI = thisApp.subject.value;
                    var dataSources = g.statementsMatching(thisApp.subject, SOLID('dataSource'), undefined);
                    if (dataSources.length > 0) {
                        $scope.sourcesToLoad = dataSources.length;
                        dataSources.forEach(function(source) {
                            if (source.object.value.length > 0) {
                                // Check if inside own workspace
                                var dataSource = {};
                                dataSource.uri = source.object.value;
                                dataSource.checked = true;
                                dataSource.name = $scope.getNameFromParentWS(source.object.value);
                                $scope.setParentWorkspace(source.object.value);
                                $scope.my.config.datasources.push(dataSource);
                                // Load contacts from sources
                                $scope.loadContacts(source.object.value);
                            }
                        });
                        // start listening for changes
                        $scope.setupWebSockets();
                        $scope.saveLocalStorage();
                    } else {
                        $scope.my.config.loaded = true;
                        $scope.$apply();
                    }
                } else {
                    console.log("Could not find app config file, initializing..");
                    $scope.my.config.loaded = true;
                    $scope.initialized = false;
                    $scope.saveLocalStorage();
                    $scope.$apply();
                }
            });
        } else {
            $scope.my.config.loaded = true;
        }
    };

    // load contacts from a data source
    $scope.loadContacts = function(uri, refresh) {
        var g = new $rdf.graph();
        var f = new $rdf.fetcher(g, TIMEOUT);
        $scope.loadingText = "...Loading contacts form "+uri;
        return new Promise(function(resolve) {
            f.nowOrWhenFetched(uri+'*',undefined,function(ok, body, xhr) {
                if (!$scope.refreshContacts) {
                    $scope.refreshContacts = [];
                }
                var contacts = g.statementsMatching(undefined, RDF('type'), VCARD('Individual'));
                if (contacts && contacts.length > 0) {
                    for (var i=0; i<contacts.length; i++) {
                        var subject = contacts[i].subject;
                        var contact = {};
                        contact.id = i;
                        contact.uri = subject.value;
                        contact.datasource = { uri: uri };

                        // save list of URIs to check if some must be removed
                        $scope.refreshContacts.push(contact.uri);
                        // create a new element for a contact
                        var newElement = function(arr, elem) {
                            if (arr.length > 0) {
                                contact[elem.name] = [];
                                for (var i=0; i<arr.length; i++) {
                                    // Set the right why value to subject value if it's an ldp#resource
                                    var ldpRes = g.statementsMatching($rdf.sym(uri+'*'), LDP('contains'), subject);
                                    if (ldpRes.length > 0) {
                                        arr[i].why.uri = arr[i].why.value = subject.value;
                                    }
                                    contact[elem.name].push($scope.ContactElement(arr[i], true));
                                }
                            }
                        };

                        $scope.vcardElems.forEach(function(elem) {
                            newElement(g.statementsMatching(subject, VCARD(elem.name), undefined), elem);
                        });

                        // set favorite value
                        var fav = g.statementsMatching($rdf.sym($scope.my.webid), FAV('hasFavorite'), subject);
                        if (fav.length > 0) {
                            var ldpRes = g.statementsMatching($rdf.sym(uri+'*'), LDP('contains'), subject);
                            if (ldpRes.length > 0) {
                                var why = subject.value;
                            } else {
                                var why = contacts[i].why.value;
                            }
                            contact['hasFavorite'] = [ $scope.ContactElement(
                                    new $rdf.st($rdf.sym($scope.my.webid), FAV('hasFavorite'), subject, $rdf.sym(why)),
                                    true
                                ) ];
                        }

                        // push contact to list
                        $scope.contacts[contact.uri] = contact;
                    }
                }
                $scope.sourcesToLoad--;
                if ($scope.sourcesToLoad===0) {
                    $scope.my.config.loaded = true;
                    $scope.removeContactsAfterRefresh(uri);
                } else if (refresh) {
                    $scope.removeContactsAfterRefresh(uri);
                }
                $scope.saveLocalStorage();
                $scope.$apply();
                resolve(contacts.length);
            });
        });
    };

    $scope.setParentWorkspace = function (uri) {
        for (var i in $scope.my.config.availableWorkspaces) {
            var ws = $scope.my.config.availableWorkspaces[i];
            if (uri.indexOf(ws.uri) >= 0) {
                ws.checked = true;
                ws.datasource = uri;
            }
        }
        return '';
    };

    $scope.getNameFromParentWS = function (uri) {
        for (var i in $scope.my.config.availableWorkspaces) {
            var ws = $scope.my.config.availableWorkspaces[i];
            if (uri.indexOf(ws.uri) >= 0) {
                return ws.name;
            }
        }
        return uri;
    };

    $scope.removeContactsAfterRefresh = function(dataSource) {
        if ($scope.contacts && $scope.refreshContacts) {
            for (var i in $scope.contacts) {
                if ($scope.refreshContacts.indexOf(i) < 0 && $scope.contacts[i].datasource.uri === dataSource) {
                    delete $scope.contacts[i];
                }
            }
            $scope.refreshContacts = [];
        }
    }

    $scope.refresh = function() {
        var webid = angular.copy($scope.my.webid);
        // $scope.init();
        $scope.my.config = {};
        $scope.getProfile(webid);
    };

    $scope.toggleFavorite = function(id) {
        if ($scope.contacts[id].hasFavorite && $scope.contacts[id].hasFavorite[0]) {
            if ($scope.contacts[id].hasFavorite[0].value.length > 0) {
                $scope.contacts[id].hasFavorite[0].value='';
            } else {
                $scope.contacts[id].hasFavorite[0].value = $scope.contacts[id].uri;
            }
        } else {
            $scope.contacts[id].hasFavorite = [ $scope.ContactElement(
                new $rdf.st($rdf.sym($scope.my.webid), FAV('hasFavorite'), $rdf.sym(''), $rdf.sym($scope.contacts[id].uri))
            )];
            $scope.contacts[id].hasFavorite[0].value = $scope.contacts[id].uri;
        }
        $scope.updateContact($scope.contacts[id]).then(function(status) {
            if (status == -1) {
                $scope.notify('warning', 'Failed to update contact', status);
            } else if (status >= 200 && status < 400) {
                $scope.saveLocalStorage();
                $scope.notify('success', 'Contact updated');
                $scope.$apply();
            } else {
                $scope.notify('error', 'Failed to update contact -- HTTP', status);
            }
        });
    };

    $scope.updateContact = function(contact, force) {
        function toNT(s, isUri) {
            var object = (isUri)?$rdf.sym(s.object.value):$rdf.lit(s.object.value);
            return new $rdf.st(
                $rdf.sym(s.subject.value),
                $rdf.sym(s.predicate.value),
                object
            );

        };

        // iterate through all the elements of a contact
        var query = '';
        var insQuery = '';
        var delQuery = '';
        // var graphURI = '';
        for (var i=0; i<$scope.vcardElems.length; i++) {
            var elem = $scope.vcardElems[i];
            if (contact[elem.name] === undefined) {
                continue;
            }
            var toSplice = [];
            for (var j=0; j<contact[elem.name].length; j++) {
                var object = contact[elem.name][j];
                if (object.value == object.prev && !force) {
                    continue;
                }
                if (object.value) {
                    object.value.trim();
                }
                // also delete object from contact
                if (object.value.length === 0) {
                    toSplice.push(j);
                }

                if (!object.failed && object.value) {
                    object.prev = angular.copy(object.value);
                }

                if (object.statement) {
                    if (object.statement.subject.value === "" && contact.uri && contact.uri.length > 0) {
                        object.statement.subject.value = object.statement.subject.uri = contact.uri;
                    }
                    var oldS = angular.copy(object.statement);
                    var newS = object.statement;
                    var val = (elem.prefixURI)?elem.prefixURI+object.value:object.value;
                    newS.object.uri = newS.object.value = val;
                }

                if (oldS && oldS.object.value && oldS.object.value.length > 0) {
                    if (delQuery.length > 0) {
                        delQuery += " ;\n";
                    }
                    delQuery += "DELETE DATA { " + toNT(oldS, elem.link) + " }";
                }
                if (object.value && object.value.length > 0) {
                    if (insQuery.length > 0) {
                        insQuery += " ;\n";
                    }
                    insQuery += "INSERT DATA { " + toNT(newS, elem.link) + " }";
                }
                // if (!graphURI) {
                //     graphURI = '';
                // }
                // if (graphURI.length === 0) {
                //     if (newS && newS.why.value.length > 0) {
                //         graphURI = newS.why.value;
                //     } else {
                //         graphURI = newS.subject.value;
                //     }
                // }
            }
            // remove empty elements
            for (var e in toSplice) {
                contact[elem.name].splice(toSplice[e], 1);
            }
        }
        query += delQuery;
        if (delQuery.length > 0) {
            query += " ;\n";
        }
        query += insQuery;

        return new Promise(function(resolve) {
            $scope.sendSPARQLPatch(contact.uri, query).then(function(status) {
                // all done
                resolve(status);
            });
        });
    };

    // Sends SPARQL patches over the wire
    $scope.sendSPARQLPatch = function (uri, query, obj, oldStatement) {
        return new Promise(function(resolve) {
            if (!uri || !query || uri.length === 0 || query.length ===0) {
                resolve(-1);
            } else {
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
            }
        });
    };

    // LDP helper function
    $scope.newContainer = function(uri, slug, metadata, type, rdfType) {
        return new Promise(function(resolve) {
            var containerURI = uri;
            var linkHeader = (type==='ldpc')?'<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"':'<http://www.w3.org/ns/ldp#Resource>; rel="type"';
            var resp = {
                code: 0,
                location: '',
            };
            var g = new $rdf.graph();
            var f = new $rdf.fetcher(g, TIMEOUT);

            // Fetch user data
            f.nowOrWhenFetched(uri,undefined,function(ok, body, xhr) {
                resp.code = xhr.status;
                if (ok) {
                    var exists = [];
                    if (rdfType) {
                        exists = g.statementsMatching(undefined, RDF('type'), $rdf.sym(rdfType));
                    }
                    if (exists.length > 0) {
                        resp.location = exists[0].subject.value;
                        resolve(resp);
                    } else {
                        // just go ahead and create a new container
                        $http({
                            method: 'POST',
                            url: uri,
                            headers: {
                                'Content-Type': 'text/turtle',
                                'Link': linkHeader,
                                'Slug': slug
                            },
                            withCredentials: true,
                            data: metadata
                        }).success(function(data, status, headers) {
                            if (headers("Location") && headers("Location").length > 0) {
                                containerURI = headers("Location");
                            }
                            resp.code = status;
                            resp.location = containerURI;
                            resolve(resp);
                        }).error(function(data, status, headers) {
                            resp.code = status;
                            resp.location = containerURI;
                            resolve(resp);
                        });
                    }
                }
            });
        });
    }

    // save app configuration if it's the first time the app runs
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

            var toBeCreated = [];
            for (var i=0; i<$scope.my.config.availableWorkspaces.length; i++) {
                if ($scope.my.config.availableWorkspaces[i].checked) {
                    toBeCreated.push($scope.my.config.availableWorkspaces[i].uri);
                }
            }
            var triples = new $rdf.Serializer(g).toN3(g);
            $http({
                method: 'POST',
                url: $scope.my.config.appWorkspace,
                withCredentials: true,
                headers: {
                    "Content-Type": "text/turtle",
                    "Slug": "Contacts"
                },
                data: triples
            }).
            success(function(data, status, headers) {
                if (headers('Location')) {
                    $scope.my.config.uri = headers('Location');
                } else {
                    $scope.my.config.uri = $scope.my.config.appWorkspace + "Contacts";
                }
                // create containers
                $scope.notify('success', 'Created config file');
                $scope.my.config.appConfigURI = $scope.my.config.uri+"#conf";
                $scope.my.toInit = toBeCreated.length;
                for (var i=0; i<toBeCreated.length; i++) {
                    $scope.initDataContainer(toBeCreated[i]);
                }
                $scope.contacts = {};
            }).
            error(function(data, status, headers) {
                console.log('Error - '+status, data);
                $scope.notify('error', 'Failed to create config file -- HTTP '+status);
            });
        }
    };

    // Initialize Apps workspace if user doesn't have one already
    $scope.initAppWorkspace = function() {
        if ($scope.storageURI.checked) {
            var uri = $scope.storageURI.checked;
            $scope.newContainer(uri, 'Applications', '', 'ldpc').then(function(status) {
                if (status.code == 201 && status.location && status.location.length > 0) {
                    if ($scope.my.config.preferencesFile) {
                        // Add new workspace triples to the preferencesFile
                        var query = "INSERT DATA { " + $scope.rdfStatementToNT($rdf.sym($scope.my.webid), PIM('workspace'), $rdf.sym(status.location)) + " } ;\n";
                        query += "INSERT DATA { " + $scope.rdfStatementToNT($rdf.sym(status.location), RDF('type'), PIM('Workspace')) + " } ;\n";
                        query += "INSERT DATA { " + $scope.rdfStatementToNT($rdf.sym(status.location), RDF('type'), PIM('PreferencesWorkspace')) + " } ;\n";
                        query += "INSERT DATA { " + $scope.rdfStatementToNT($rdf.sym(status.location), DCT('title'), $rdf.lit("App configuration workspace")) + " }";
                        $scope.sendSPARQLPatch($scope.my.config.preferencesFile, query).then(function(result) {
                            // all done
                            $scope.my.config.appWorkspace = status.location;
                            $scope.saveLocalStorage();
                            $scope.initApp();
                            $scope.notify('success', 'Created configuration workspace');
                            $scope.$apply();
                        });
                    }
                } else if (status.code >= 400) {
                    console.log("HTTP " + status + ": failed to create ldpc for "+status.location);
                    $scope.notify('error', 'Failed to create config workspace -- HTTP '+status.status);
                }
            });
        }
    };

    $scope.initDataContainer = function(workspace, name) {
        if (!workspace || workspace.length === 0) {
            console.log("Must provide workspace URI! Got:", workspace);
            return;
        }
        if (!name || name.length === 0) {
            name = 'contacts';
        }
        // Add type for the data source container
        var triples, g = new $rdf.graph();
        g.add($rdf.sym(''), RDF('type'), VCARD('AddressBook'));
        triples = new $rdf.Serializer(g).toN3(g);

        $scope.newContainer(workspace, name, triples, 'ldpc', VCARD('AddressBook').value).then(function(status) {
            if (status.code === 200 || status.code === 201) {
                $scope.my.toInit--;
                if ($scope.my.toInit >= 0 && status.location && status.location.length > 0) {
                    if (status.location.slice(status.location.length - 1) !== '/') {
                        status.location += '/';
                    }

                    var query = "INSERT DATA { " + $scope.rdfStatementToNT($rdf.sym($scope.my.config.appConfigURI), SOLID('dataSource'), $rdf.sym(status.location)) + " }";
                    $scope.sendSPARQLPatch($scope.my.config.appConfigURI, query).then(function(result) {
                        // load contacts
                        $scope.loadContacts(status.location);
                        // all done
                        $scope.my.config.datasources.push({ uri: status.location });
                        $scope.setParentWorkspace(status.location);
                        $scope.initialized = true;
                        $scope.saveLocalStorage();
                        $scope.$apply();
                    });
                }
                if ($scope.my.toInit === 0) {
                    $scope.my.config.loaded = true;
                }
            } else if (status.code === 406) {
                console.log("HTTP " + status + ": failed to create ldpc in "+workspace+". Retrying with "+name+attempt.toString());
                $scope.initDataContainer(workspace);
            } else {
                // error creating containers for contacts in workspace
                $scope.notify('error', 'Failed to create LDPC -- HTTP '+status);
                console.log("HTTP " + status + ": failed to create ldpc in "+workspace);
            }
        });
    };

    // $scope.addRemoteSource = function () {
    //     if (!$scope.remoteSources) {
    //         $scope.remoteSources = [];
    //     }
    //     $scope.remoteSources.push({uri: ''});
    //     $scope.focusElement('source-'+String($scope.remoteSources.length-1));
    // };

    $scope.savePreferences = function () {
        var toDelete = [];
        var toAdd = [];
        for (var i=0; i < $scope.my.config.availableWorkspaces.length; i++) {
            var ws = $scope.my.config.availableWorkspaces[i];
            // remove datasources
            if (!ws.checked && ws.datasource) {
                toDelete.push(ws.datasource);
                delete ws.datasource;
            }
            if (ws.checked && !ws.datasource) {
                toAdd.push(ws.uri);
            }
        }
        // also add remote sources
        // if ($scope.remoteSources && $scope.remoteSources.length > 0) {
        //     $scope.remoteSources.forEach(function (src) {
        //         if (src.uri && src.uri.length > 0) {
        //             toAdd.push(src.uri);
        //         }
        //     });
        // }

        // delete dataSources
        var query = '';
        for (var i=0; i < toDelete.length; i++) {
            query += "DELETE DATA { " + $scope.rdfStatementToNT($rdf.sym($scope.my.config.appConfigURI), SOLID('dataSource'), $rdf.sym(toDelete[i])) + " }";
            if (i < toDelete.length - 1 || (i === toDelete.length - 1 && toDelete.length > 0)) {
                query += " ;\n";
            }
        }
        $scope.sendSPARQLPatch($scope.my.config.appConfigURI, query).then(function(result) {
            // deleted old dataSources, now remove contacts from view
            if (toDelete.length > 0) {
                // remove sources from local cache
                for (var i = $scope.my.config.datasources.length - 1; i >= 0; i--) {
                    var ws = $scope.my.config.datasources[i];
                    for (var d in toDelete) {
                        if (toDelete[d] === ws.uri) {
                            $scope.my.config.datasources.splice(i, 1);
                        }
                    }
                }
                // remove from view
                for (var uri in $scope.contacts) {
                    for (var i in toDelete) {
                        if (uri.indexOf(toDelete[i]) >= 0) {
                            delete $scope.contacts[uri];
                        }
                    }
                }
            }

            // add new data sources
            $scope.my.toInit = toAdd.length;
            for (var i=0; i < toAdd.length; i++) {
                $scope.initDataContainer(toAdd[i]);
            }
            // close dialog
            $scope.saveLocalStorage();
            $scope.notify('success', 'Preferences updated');
            LxDialogService.close('preferences');
        });
    };

    $scope.rdfStatementToNT = function(s, p, o) {
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

    $scope.manageSelection = function(uri, force) {
        if ($scope.contacts[uri].checked || force === true) {
            $scope.contacts[uri].checked = true;
            // add to selection list
            $scope.selects.contacts.push(uri);
        } else {
            // remove from selection list
            for(var i = $scope.selects.contacts.length - 1; i >= 0; i--) {
                if ($scope.selects.contacts[i] === uri) {
                    $scope.selects.contacts.splice(i, 1);
                }
            }
        }
    };

    $scope.selectOne = function (contact) {
        if ($scope.selects.contacts.length > 0) {
            contact.checked = !contact.checked;
            $scope.manageSelection(contact.uri);
        }
    };

    $scope.selectAll = function() {
        $scope.selects.contacts = [];
        for (var i in $scope.contacts) {
           $scope.contacts[i].checked = true;
           $scope.selects.contacts.push(i);
        }
    };

    $scope.selectNone = function() {
        for (var i in $scope.contacts) {
           $scope.contacts[i].checked = false;
        }
        $scope.selects.contacts = [];
    };

    $scope.space2dash = function(elem, obj) {
        if (elem == 'hasTelephone') {
            obj.value = (!obj.value) ? '' : obj.value.replace(/\s+/g, '-');
        }
    }

    // Dialogues
    $scope.openDialog = function(elem, reset) {
        if (reset) {
            $scope.resetContact();
        }
        LxDialogService.open(elem);
        $(document).keyup(function(e) {
          if (e.keyCode===27) {
            LxDialogService.close(elem);
          }
        });
    };

    $scope.nrContacts = function () {
        Object.getOwnPropertyNames($scope.contacts);
        return Object.getOwnPropertyNames($scope.contacts).length;
    };

    // Login
    $scope.TLSlogin = function() {
        $location.path('/').search({}).replace();
        $scope.loginTLSButtonText = 'Logging in...';
        console.log("AUTH:",AUTHENDPOINT);
        $http({
          method: 'HEAD',
          url: AUTHENDPOINT,
          withCredentials: true
        }).success(function(data, status, headers) {
          // add dir to local list
          var user = headers('User');
          console.log("USER:",user);
          if (user && user.length > 0 && user.slice(0,4) == 'http') {
            $scope.loggedIn = true;
            $scope.getProfile(user);
          } else {
            LxNotificationService.error('WebID-TLS authentication failed.');
            console.log('WebID-TLS authentication failed.');
          }
          $scope.loginTLSButtonText = 'Login';
        }).error(function(data, status, headers) {
            LxNotificationService.error('Could not connect to auth server: HTTP '+status);
            console.log('Could not connect to auth server: HTTP '+status);
            $scope.loginTLSButtonText = 'Login';
        });
    };

    $scope.saveLocalStorage = function() {
        var data = {
            profile: $scope.my,
            loggedIn: $scope.loggedIn,
            contacts: $scope.contacts
        };
        localStorage.setItem($scope.app.origin, JSON.stringify(data));
    };

    $scope.logOut = function() {
        $scope.init();
        // clear localstorage
        localStorage.removeItem($scope.app.origin);
        $scope.loggedIn = false;
    };

    $scope.online = window.navigator.onLine;
    // Is offline
    $window.addEventListener("offline", function () {
        $scope.$apply(function() {
            console.log("Offline -- lost connection");
        });
    }, false);
    // Is online
    $window.addEventListener("online", function () {
        $scope.$apply(function() {
            console.log("Online -- connection restored");
            $scope.setupWebSockets();
        });
    }, false);

    // initialize by retrieving user info from localStorage
    $scope.init();
    if (localStorage.getItem($scope.app.origin)) {
        var data = JSON.parse(localStorage.getItem($scope.app.origin));
        if (data) {
            // don't let session data become stale (24h validity)
            var dateValid = data.profile.loadDate + 1000 * 60 * 60 * 24;
            if (Date.now() < dateValid) {
                $scope.my = data.profile;
                if (!$scope.my.config.appWorkspace || $scope.my.config.appWorkspace.length === 0) {
                    $scope.initialized = false;
                }
                if ($scope.my.config.datasources && $scope.my.config.datasources.length === 0) {
                    $scope.initialized = false;
                }
                $scope.contacts = data.contacts;
                $scope.my.config.loaded = true;
                $scope.loggedIn = true;

                $scope.setupWebSockets();

                console.log("Loaded", $scope.nrContacts(), "contacts");
            } else {
                console.log("Deleting profile data because it expired");
                localStorage.removeItem($scope.app.origin);
            }
        } else {
            // clear sessionStorage in case there was a change to the data structure
            console.log("Deleting profile because of structure change");
            localStorage.removeItem($scope.app.origin);
        }
    }

    // view contact
    if ($location.$$path && $location.$$path === '/contacts/view' && $location.$$search && $location.$$search.uri) {
        var uri = $location.$$search.uri;
        if ($scope.contacts && $scope.contacts[uri]) {
            // view
            $scope.viewContact(uri);
        } else {
            // load
            $scope.sourcesToLoad = 1;
            $scope.loggedIn = true;
            $scope.loadContacts(uri).then(function(res) {
                if (res > 0) {
                    $scope.viewContact(uri);
                }
            });
        }
    }
});

App.directive('contacts',function(){
    return {
      replace : true,
      restrict : 'E',
      templateUrl: 'app/views/contacts.tpl.html'
    };
});
App.directive('contact',function(){
    return {
      replace : true,
      restrict : 'E',
      templateUrl: 'app/views/contact.tpl.html'
    };
});
App.directive('workspaces',function(){
    return {
      replace : true,
      restrict : 'E',
      templateUrl: 'app/views/workspaces.tpl.html'
    };
});
