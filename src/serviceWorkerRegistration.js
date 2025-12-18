import { Workbox } from 'workbox-window';

export function register(config) {
  if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    const publicUrl = new URL(process.env.PUBLIC_URL, window.location.href);
    if (publicUrl.origin !== window.location.origin) {
      return;
    }

    const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;
    const wb = new Workbox(swUrl);

    // 注册生命周期钩子
    // 1. Waiting (Update found but waiting for control)
    wb.addEventListener('waiting', (event) => {
      console.log('New service worker waiting to activate');
      if (config && config.onUpdate) {
        // Pass the Workbox instance or registration to the callback
        // The original CRA implementation passed the registration object
        // Here we can pass an object that mimics it or just the wb instance if we adapt the consumer
        // To keep compatibility with our index.js:
        // config.onUpdate(registration) -> we need the registration object
        // wb.messageSkipWaiting() handles the skip waiting
        
        // Let's get the underlying registration
        wb.getSW().then(sw => {
           // Wait, we need the registration, not the SW.
           // wb.register() returns the registration, but this event might fire before register() resolves?
           // No, usually after.
           navigator.serviceWorker.getRegistration().then(registration => {
               if (config.onUpdate && registration) {
                   config.onUpdate(registration);
               }
           });
        });
      }
    });

    // 2. Installed
    wb.addEventListener('installed', (event) => {
       if (!event.isUpdate) {
           console.log('Service worker installed for the first time');
           if (config && config.onSuccess) {
               navigator.serviceWorker.getRegistration().then(registration => {
                   if (registration) config.onSuccess(registration);
               });
           }
       }
    });

    // 3. Controlling (Reload when new SW takes control)
    wb.addEventListener('controlling', () => {
       console.log('Service worker now controlling page, reloading...');
       window.location.reload();
    });

    wb.register().catch(error => {
       console.error('Error during service worker registration:', error);
    });
  }
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
}
