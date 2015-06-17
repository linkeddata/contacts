var Contacts = angular.module('Contacts', ['lumx']);


Contacts.controller('Main', function($scope) {
    $scope.loggedIn = true;
    $scope.my = {
        name: "Andrei Vlad Sambra",
        email: "andrei@w3.org"
    };

    $scope.contacts = [
        {
            name: "First contact",
            email: "first@email.com",
            favorite: '',
            checked: false
        },
        {
            name: "Second contact",
            email: "second@example.org",
            phone: "+1-231-114-1231",
            favorite: 'favorite',
            checked: false
        }
    ];


    $scope.viewLogin = function() {
        $scope.loggedIn = true;
        $mdSidenav('leftnav').close();
    };

    $scope.logOut = function() {
        $scope.loggedIn = false;
    };

    $scope.hoverContact = function(i, hover) {
        if ($scope.contacts) {
            if ($scope.contacts[i].checked) {
                $scope.contacts[i].showcheckbox = true;
                $scope.contacts[i].hidepic = true;
            } else {
                if (hover) {
                    $scope.contacts[i].showcheckbox = true;
                    $scope.contacts[i].hidepic = true;
                } else {
                    $scope.contacts[i].showcheckbox = false;
                    $scope.contacts[i].hidepic = false;
                }
            }
        }
    };

    
});

Contacts.directive('profileCard',function(){
    return {
      replace : true,
      restrict : 'E',
      templateUrl: 'app/profileCard.tpl.html'
    }; 
});