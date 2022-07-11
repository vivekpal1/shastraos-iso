/* === This file is part of Calamares - <http://github.com/calamares> ===
 *
 *   Copyright 2015, Teo Mrnjavac <teo@kde.org>
 *
 *   Calamares is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 */

import QtQuick 2.0;
import calamares.slideshow 1.0;

Presentation
{
    id: presentation

    function nextSlide() {
        console.log("QML Component (default slideshow) Next slide");
        presentation.goToNextSlide();
    }

    Timer {
        id: advanceTimer
        interval: 5000
        running: presentation.activatedInCalamares
        repeat: true
        onTriggered: nextSlide()
    }

    Slide {
        anchors.fill: parent

        Image {
            id: background1
            source: "slides/slide1.png"
            anchors.fill: parent
        }
    }

    Slide {
        anchors.fill: parent

        Image {
            id: background2
            source: "slides/slide2.png"
            anchors.fill: parent
        }
    }

    Slide {
        anchors.fill: parent

        Image {
            id: background3
            source: "slides/slide3.png"
            anchors.fill: parent
        }
    }
    
    Slide {
        anchors.fill: parent

        Image {
            id: background4
            source: "slides/slide4.png"
            anchors.fill: parent
        }
    }

    Slide {
        anchors.fill: parent

        Image {
            id: background4
            source: "slides/slide4.png"
            anchors.fill: parent
        }
    }
    
    function onActivate() {
        console.log("QML Component (default slideshow) activated");
        presentation.currentSlide = 0;
    }

    function onLeave() {
        console.log("QML Component (default slideshow) deactivated");
    }

}
