import { useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Progress } from '@nextui-org/react';
import { formatFileSize } from '../utils';

const DownloadProgress: React.FC<{ show: boolean }> = ({ show }) => {
    const [progress, setProgress] = useState(0);
    const [totalSize, setTotalSize] = useState(0);
    const progressRef = useRef(0);
    const totalSizeRef = useRef(0);

    useEffect(() => {
        const unlistenDownload = listen<number>('download-progress', (event) => {
            progressRef.current = event.payload;
        });

        const unlistenZip = listen<number>('zip-progress', (event) => {
            progressRef.current = event.payload;
        });

        const unlistenTotalSize = listen<number>('total-size', (event) => {
            totalSizeRef.current = event.payload;
        });

        const intervalId = setInterval(() => {
            setProgress(progressRef.current);
            setTotalSize(totalSizeRef.current);
        }, 250);

        return () => {
            clearInterval(intervalId);
            unlistenDownload.then((unlisten) => unlisten());
            unlistenZip.then((unlisten) => unlisten());
            unlistenTotalSize.then((unlisten) => unlisten());
        };
    }, []);

    if (!show) {
        return null;
    }

    const percentage = totalSize > 0 ? (progress / totalSize) * 100 : 0;

    return (
        <Progress
            aria-label={"Progress..."}
            size="sm"
            classNames={{
                base: "max-w-md",
                track: "drop-shadow-md border border-default",
                indicator: "#59c59f",
                label: "tracking-wider font-medium text-default-600",
                value: "text-foreground/60",
            }}
            label={`Progress: ${formatFileSize(progress)} / ${formatFileSize(totalSize)}`}
            value={percentage}
            color="primary"
            showValueLabel={true}
        />
    );
};

export default DownloadProgress;
