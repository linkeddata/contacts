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
                console.log("Checkbox checked");
            } else {
                console.log("Checkbox not checked");
                if (hover) {
                    console.log("Hovering");
                    $scope.contacts[i].showcheckbox = true;
                    $scope.contacts[i].hidepic = true;
                } else {
                    console.log("No hovering");
                    $scope.contacts[i].showcheckbox = false;
                    $scope.contacts[i].hidepic = false;
                }
            }
            console.log("checked: " + $scope.contacts[i].checked + " / showcheckbox: "+$scope.contacts[i].showcheckbox + " / hidepic: " + $scope.contacts[i].hidepic + "\n--------");
            // $scope.contacts[i].showpic = ($scope.contacts[i].checked && !hover)?false:true;
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