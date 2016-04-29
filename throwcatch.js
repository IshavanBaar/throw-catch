
// for coordination between interact functions (eg. dragging and droping)
var globalaction = "";
var justDroppedOnZone = false;
var thrown = false;
toss_threshold = 800;
var velocity_history = new Velocity_History();
// gotta keep track of the active zones because interacte().dropzone deactivates them before we can check their classes
var last_active_zone = null;
var active_icon = null;
// used to prevent us from trying to end a drop multiple times
var throw_at_edge = false;
var which_edge_hit = null;
// track what the current view level is
var current_folder_id = "none";
var rotation = "0";
var translation = "";

function apply_style (target) {
    target.style.webkitTransform =
    target.style.transform =
        translation + " rotate(" + rotation + "deg)";
}

function reset_icon_location (target) {
    reset_object_location(target, target.originalIconX, target.originalIconY);
}
function reset_icon_location_with_offset (target) {
    reset_object_location(target, target.originalIconX + 40, target.originalIconY + -30);
}
function reset_marker_location (target) {
    reset_object_location(target, target.originalMarkerX, target.originalMarkerY);
}
function reset_object_location (target, x, y) {
    target.setAttribute('data-x',x);
    target.setAttribute('data-y',y);
    translation = 'translate(' + x + 'px, ' + y + 'px)';
    rotation = '0';
    apply_style(target);
}


// extract the zone type from the class name
function zoneTypeFromZone (zone) {
    var r = /(.*)-zone/;
    classes = zone.classList;
    return class_from_class_list(classes, r);
}

function class_from_class_list (classes, regexp) {
    for (var i = 0, len = classes.length; i < len; i++) {
        if ( regexp.test(classes[i]) ) {
            zone_type = regexp.exec(classes[i])[1];
            return zone_type;
        }
    }
    return false;
}



function edge_zone_mapping (zone_list) {
    for ( var zid = 0, len = zone_list.length; zid < len; zid++) {
        z = zone_list[zid];
        if ( z.classList.contains(which_edge_hit) && z.classList.contains("drop-active") ) {
console.log('mapping: on zone "'+z.id+'"');
            return zoneTypeFromZone(z);
        }
    }
    return false;
}


// determines if the marker stopped over zone when thrown (unfortunately we have a bug
//   when throwing over drop zones from forcing the inertia to end)
function was_over_visible_zone (event) {
    x = event.x0 + event.dx;
    y = event.y0 + event.dy;
    z = last_active_zone;
    if ( z ) {
        zX0 = z.offsetLeft;
        zX1 = z.offsetLeft + z.offsetWidth;
        zY0 = z.offsetTop;
        zY1 = z.offsetTop + z.offsetHeight;
        if ( ( x > zX0 ) && ( x < zX1 ) &&
             ( y > zY0 ) && ( y < zY1) ) {
            zone_type = zoneTypeFromZone(z);
            if ( zone_type ) {
                console.log('on zone "'+z.id+'", type: '+zone_type);
                return zone_type;
            } else {
                // alert("no zone_type found");
            }
            alert('non-brute: on zone "'+z.id+'"');
        } else {
            console.log('non-brute: no match zid:'+z.id+' z:'+zX0+','+zX1+','+zY0+','+zY1);
        }
    }
    console.log('non-brute: not on zone, x'+x+' y'+y+' dx'+event.dx+' dy'+event.dy);
    return false;
}

// this actually does the work of the activated zone
function activate_zone_function (marker, zone_name) {
// console.log("marker" + marker);
// console.log("zone_name" + zone_name);
    globalaction = zone_name;
    var cases = {
        copy: function() {
            // there was once a bug where icons could be copied. We couldn't reproduce it, so this is a safety check to make sure we only copy markers, not icons
            if ( marker.classList.contains('marker') ) {
                console.log("copying");
                old_img = $('#'+marker.id)[0]
                new_img = $('#'+marker.id).clone().appendTo('.demo-area');
                new_img[0].id = (new Date()).getTime().toString();
                new_img[0].classList.add("marker-copy");
                new_img.datax = old_img.getAttribute("data-x");
                new_img.datay = old_img.getAttribute("data-y");
                rotation = '0';
                apply_style(new_img[0]);
                reset_marker_location(old_img);
            }
        },
        cancel: function() {
            console.log("canceling");
            turn_marker_to_icon_via_cancel(marker);
            // if it's a copy, set sane defaults
            rotation = '0';
            apply_style(marker);
            reset_icon_location(marker);
        },
        delete: function() {
            console.log("deleting");
            console.log(marker);
            parent_folder_id = get_parent_id( $('#'+target.id)[0] );
            target.classList.remove('parent-'+parent_folder_id);
            target.classList.add('parent-trash-folder');
            // marker.style.display="none";
            refresh_display();
        },
        _default: function() { alert('zone_name "'+zone_name+'" is not a valid name'); }
    };
    cases[ zone_name ] ? cases[ zone_name ]() : cases._default();
}











// target elements with the "draggable" class
interact('.draggable')
    // enable inertial throwing
    .inertia({
        resistance       : 1,    // the lambda in exponential decay
        minSpeed         : toss_threshold,   // target speed must be above this for inertia to start
        endSpeed         : 10,    // the speed at which inertia is slow enough to stop
        allowResume      : true,  // allow resuming an action in inertia phase
        zeroResumeDelta  : false, // if an action is resumed after launch, set dx/dy to 0
        smoothEndDuration: 300,   // animate to snap/restrict endOnly if there's no inertia

    })

    .draggable({
        onstart: function (event) {
console.log('------------');
            rotation = "0";
            target = event.target;
            justDroppedOnZone = false;
            thrown = false;
            throw_at_edge = false;
            // attempt to fix copied markers who are now icons from jumping
            if ( target.getAttribute('datax') ) {
                target.setAttribute('data-x', target.getAttribute("datax"));
                target.setAttribute('data-y', target.getAttribute("datay"));
            }
            which_edge_hit = null;
            if ( target.classList.contains('marker') == true ) {
                // store initial coordinates in case the throw-catch is canceled
                target.originalMarkerX = (parseFloat(target.getAttribute('data-x')) || 0),
                target.originalMarkerY = (parseFloat(target.getAttribute('data-y')) || 0);
            } else {
                target.originalIconX = (parseFloat(target.getAttribute('data-x')) || 0),
                target.originalIconY = (parseFloat(target.getAttribute('data-y')) || 0);
            }
// console.log('orig x: '+target.originalIconX);
// console.log('data-x: '+target.getAttribute('data-x')+'         dx.'+event.dx);
// console.log('orig y: '+target.originalIconY);
// console.log('data-y: '+target.getAttribute('data-y')+'         dy.'+event.dy);

        },
        onmove: function (event) {
            var target = event.target,
                // keep the dragged position in the data-x/data-y attributes
                x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx,
                y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
// console.log(x+','+y);
            // translate the element
            translation = 'translate(' + x + 'px, ' + y + 'px) ';

            // update the position attributes
            target.setAttribute('data-x', x);
            target.setAttribute('data-y', y);

            if (event.speed) {
               velocity_history.add( event.speed );
            }
            if ( ( velocity_history.average() > toss_threshold ) || event.interaction.inertiaStatus.active ) {
                rotation = '90';
            } else {
                rotation = '0';
            }

            // set thrown flag if it's not already set and we're coasting
            if ( (thrown == false) && (event.interaction.inertiaStatus.active) ) { thrown = true; };

            // todo: The method of aborting the inertia is causing errors in Interaction.inertiaFrame
            //  (there's an Interaction without a target being inertially processed)
            if ( at_edge(event) && event.interaction.inertiaStatus.active ) {
                zone = edge_zone_mapping ($('.dropzone'));
                // zone = was_over_visible_zone_brute_force( event, $('.dropzone') );

                console.log('move: ending inertia');

                if ( zone ) {
                    console.log('move: over visible zone: '+ zone);
                    justDroppedOnZone = true;
                    activate_zone_function(event.target, zone);
                    // indicates a drop/move
                } else {
                    if ( event.target.classList.contains('marker') == false ) {
                        turn_icon_to_marker(event.target);
                        reset_icon_location_with_offset(event.target);

                    };
                }
                // end animation
                event.interaction.prepared = null;
                event.interaction.stop();
                event.interaction.inertiaStatus.active = false;
                window.cancelAnimationFrame(event.interaction.inertiaStatus.i);

                        deactivate_all_zones();

                console.log('move: drag ended');
                rotation = '0';
            }
            apply_style(event.target);
            refresh_display();
        },
        // call this function on every dragend event
        onend: function (event) {
            // remove styling in case it had been enabled
            zone = was_over_visible_zone( event );
            if ( zone ) {
                console.log('end: over visible zone: '+ zone);
                justDroppedOnZone = true;
                activate_zone_function(event.target, zone);
            }
            if ( justDroppedOnZone == false ) {
                // indicates a drop/move
                if ( event.target.classList.contains('marker') ) {
                    console.log('end: turning to icon:');
                    console.log(event.target);
                    turn_marker_to_icon_via_drop( event.target );
                };
            }
            rotation = '0';
            apply_style(event.target);
            refresh_display();
            console.log('drag ended');
        }
    })
    // keep the element within the area of it's parent
    .restrict({
        drag: "parent",
        endOnly: false,
        elementRect: { top: 0, left: 0, bottom: 1, right: 1 }
    });


// detects if we hit the edge and caused the bounding restrictions to kick in
function at_edge (event) {
    // ugly hack since we can't detect dropzones during an interia passover
    if ( event.interaction.restrictStatus.dx > 0 ) { which_edge_hit = "left"; }
    if ( event.interaction.restrictStatus.dx < 0 ) { which_edge_hit = "right"; }
    if ( event.interaction.restrictStatus.dy > 0 ) { which_edge_hit = "top"; }
    if ( event.interaction.restrictStatus.dy < 0 ) { which_edge_hit = "bottom"; }
    if ( which_edge_hit ) {
console.log('at edge:');
console.log(event.interaction.restrictStatus.dx);
console.log(event.interaction.restrictStatus.dy);
        return true;
    }
}

function turn_icon_to_marker (target) {
// console.log(target);
    target.classList.add('marker');
    target.classList.remove('icon');
    // make_marker_float(target); //todo
    rotation = '90';
    apply_style(target);
}

function turn_marker_to_icon_via_drop (target) {
// console.log(target);
    target.classList.add('icon');
    target.classList.remove('marker');
    // in case this marker has copy visual-indicator
    target.classList.remove("marker-copy");
    // update icon's parent folder value
    parent_folder_id = get_parent_id( $('#'+target.id)[0] );
    target.classList.remove('parent-'+parent_folder_id);
    target.classList.add('parent-'+current_folder_id);
}

function turn_marker_to_icon_via_cancel (target) {
// console.log(target);
    target.classList.add('icon');
    target.classList.remove('marker');
    // in case this marker has copy visual-indicator
    target.classList.remove("marker-copy");
    // refresh view in case marker came from another folder level
    refresh_display();
}

function deactivate_all_zones () {
console.log('deactivate_all_zones');
    divs = $('#basic-drag .dropzone')
    for ( var i = 0, len = divs.length; i < len; i++) {
        d=divs[i]
        d.classList.remove('drop-active');
        d.classList.remove('drop-target');
        d.classList.add('drop-inactive');
    }
}















function genericOndropactivate (event) {
console.log(event.target);
    event.target.classList.add('drop-active');
    event.target.classList.remove('drop-inactive');
}

function genericOndragenter (event) {
console.log("entered zone "+zoneTypeFromZone(event.target));
    var draggableElement = event.relatedTarget,
        dropzoneElement = event.target;
    dropzoneElement.classList.add('drop-target');
    last_active_zone = dropzoneElement;
}

function genericOndragleave (event) {
    event.target.classList.remove('drop-target');
}

function genericOndrop (event) {
    justDroppedOnZone = true;
console.log("dropped on zone (according to zone func)");
    //   taken care of by the drop function
    // activate_zone_function(event.relatedTarget, event.target)
}

function genericOndropdeactivate (event) {
    event.target.classList.remove('drop-active');
    event.target.classList.remove('drop-target');
    event.target.classList.add('drop-inactive');
}




interact('.cancel-zone').dropzone({
    accept: '.marker',
    ondropactivate: function (event) { genericOndropactivate(event); },
    ondragenter: function (event) {genericOndragenter(event); },
    ondragleave: function (event) {genericOndragleave(event); },
    ondrop: function (event) {genericOndrop(event); },
    ondropdeactivate: function (event) {genericOndropdeactivate(event); }
});


interact('.delete-zone').dropzone({
    accept: '.icon',
    ondropactivate: function (event) { genericOndropactivate(event); },
    ondragenter: function (event) {genericOndragenter(event); },
    ondragleave: function (event) {genericOndragleave(event); },
    ondrop: function (event) {genericOndrop(event); },
    ondropdeactivate: function (event) {genericOndropdeactivate(event); }
});

interact('.copy-zone').dropzone({
    accept: '.marker',
    ondropactivate: function (event) { genericOndropactivate(event); },
    ondragenter: function (event) {genericOndragenter(event); },
    ondragleave: function (event) {genericOndragleave(event); },
    ondrop: function (event) {genericOndrop(event); },
    ondropdeactivate: function (event) {genericOndropdeactivate(event); }
});






// Todo: turn this into a weighted average, so that the most recent readings have more weight
average_array = function (arr) {
    sum=0; var i=arr.length; while(i--) sum += arr[i]
    return Math.floor(sum/arr.length);
}

function Velocity_History () {
    var self = this;
    var velocity_history_max_size = 8;
    var v = [];
    self.average = function () {
        return average_array(v);
    }

    self.add = function (x) {
        v.push(x);
        if ( v.length > velocity_history_max_size ) {
            v.shift();
        }
    }

    self.truncate = function () {
        v.pop();
    }
}



////////////////////////
// Folder switching



interact('.icon')
    .on('doubletap', function (event) {
        if ( event.currentTarget.classList.contains('folder') ) {
            switch_level(event.currentTarget.id);
            event.preventDefault();
        }
    });

interact('.nav-button')
    .on('tap', function (event) {
        navButtonAction(event.currentTarget.id);
        event.preventDefault();
    });

function navButtonAction (button_name) {
    var cases = {
        back: function() {
            if ( current_folder_id == "none" ) {
                console.log("already at top folder");
                alert("already at top folder");
            } else {
                console.log("up a level");
                parent_folder_id = get_parent_id( $('#'+current_folder_id)[0] );
                switch_level(parent_folder_id);
                current_folder_id = parent_folder_id;
            }
        },
        _default: function() { alert('nav-button name "'+name+'" is not a valid action'); }
    };
    cases[ button_name ] ? cases[ button_name ]() : cases._default();
}


function hide_all() {
    $('.icon').each(function( num, icon ) {
        icon.classList.add('icon-hidden');
    });
}


function refresh_display() {
    switch_level(current_folder_id);
}

function switch_level(parent_id) {
    hide_all();
    $('.parent-'+parent_id).each(function( num, icon ) {
        icon.classList.remove('icon-hidden');
    });
    current_folder_id = parent_id;
    if ( current_folder_id == "none" ) {
        $('#back')[0].classList.add('nav-button-hidden');
    } else {
        $('#back')[0].classList.remove('nav-button-hidden');
    }
    if ( $('.parent-trash-folder').size() > 0 ) {
        // console.log("TRASH FULL");
        $('#trash-folder')[0].src = "images/trash-icon-full.png";
    } else {
        // console.log("TRASH EMPTY");
        $('#trash-folder')[0].src = "images/trash-icon.png";
    }
}


function get_parent_id (child) {
    var r = /parent-(.*)/;
    // console.log(child);
    classes = child.classList;
    return class_from_class_list(classes, r);
}



function initLayout () {
    console.log('Initializing layout');
    hide_all();
    switch_level('none');
}

