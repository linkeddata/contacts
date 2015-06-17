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
            bookmarked: false
        },
        {
            name: "Second contact",
            email: "second@example.org",
            phone: "+1-231-1134-12312",
            bookmarked: true
        }
    ];


    $scope.viewLogin = function() {
        $scope.loggedIn = true;
        $mdSidenav('leftnav').close();
    };

    $scope.logOut = function() {
        $scope.loggedIn = false;
    };


    
});

Contacts.directive('profileCard',function(){
    return {
      replace : true,
      restrict : 'E',
      templateUrl: 'app/profileCard.tpl.html'
    }; 
});