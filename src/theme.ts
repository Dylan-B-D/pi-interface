import { hexToRgba } from './utils.ts'

/**
 * Theme object that contains additional styles for Mantine components.
 * Note: Google fonts are imported into index.html.
 * NextUI theme is created in tailwind.config.js.
 */
export const theme = {
    fontFamily: 'Red Hat Display',
    
    primaryColor: 'gray',
    components: {
      Title: {
        styles: {
          root: {
            fontFamily: 'Josefin Sans',
          },
        },
      },
      SegmentedControl: {
        styles: {
          root: {
            backgroundColor: hexToRgba('#fff', 0.025),
            borderRadius: 0,
          },
          label: {
            color: 'white',
            fontWeight: 'bold',
          },
          indicator: {
            backgroundColor: hexToRgba("#64F2BE", 0.6),
            borderRadius: 0,
          },
        },
      },
      TextInput: {
        styles: {
          input: {
            backgroundColor: 'rgba(0,0,0,0.3)',
          },
        },
      },
      Notifications: {
        styles: {
          notification: {
            backgroundColor: 'rgba(0,0,0,0.3)',
          },
        },
      },
      Modal: {
        styles: {
          content: {
            backgroundColor: '#0b1416',
          },
        },
      },
    },
};