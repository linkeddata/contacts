var Contacts = angular.module('Contacts', ['lumx']);


Contacts.controller('Main', function($scope, LxDialogService) {
    $scope.loggedIn = false;

    $scope.my = {
        name: "Andrei Vlad Sambra",
        email: "andrei@w3.org",
        picture: "https://deiu.me/public/avatar.jpg"
    };

    $scope.selectedContacts = [];

    $scope.contacts = [
        {
            name: "First contact",
            email: "first@email.com",
            picture: 'https://lh4.googleusercontent.com/-dPvV6bpyaik/U_VfpkP5nnI/AAAAAAAAFHQ/6TKGdHRHFSU/w960-h962-no/1306d2a9-ea03-45e2-bdcd-ef48119c965b',
            favorite: '',
            checked: false
        },
        {
            name: "Second contact",
            email: "second@example.org",
            phone: "+1-231-114-1231",
            picture: "https://lh6.googleusercontent.com/-yqYqI3T_KRs/VYKVXGXWW_I/AAAAAAAAAwU/Bd84tPHEcoM/s500-no/Untitled-61142014104414PM.jpg",
            favorite: 'favorite',
            checked: false
        }
    ];

    $scope.viewLogin = function() {
        $scope.loggedIn = true;
    };

    $scope.logOut = function() {
        $scope.loggedIn = false;
        // $scope.my = {};
        // $scope.contacts = [];
        $scope.selectedContacts = [];
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
        } else {
            // remove from selection list
            for(var i = $scope.selectedContacts.length - 1; i >= 0; i--) {
                if ($scope.selectedContacts[i] === id) {
                   $scope.selectedContacts.splice(i, 1);
                }
            }
        }
        console.log($scope.selectedContacts);
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

    $scope.opendAddDialog = function() {
        LxDialogService.open('addcontact');
    };
});

Contacts.directive('profileCard',function(){
    return {
      replace : true,
      restrict : 'E',
      templateUrl: 'app/profileCard.tpl.html'
    }; 
});