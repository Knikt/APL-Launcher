/* Machine profile. This is the default for the reference set: a Frame, which
   carries its name on screen and offers Art Mode.

   A build for another television replaces this file at package time (the
   packaging overlay accepts a private .local/profile.js), so one source tree
   can serve a set that has no Art Mode without carrying the other set's name.
   name - the wordmark on the start screen and the window title.
   art  - whether the Art Mode controls exist at all. */
window.CleanFrameProfile = {
  name: 'Samsung Frame TV',
  art: true
};
