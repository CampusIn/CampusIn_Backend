import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";

import { emailQueue } from "../queue/email.queue.js";
import { printingQueue } from "../queue/printing.queue.js";

const serverAdapter = new ExpressAdapter()

serverAdapter.setBasePath("/admin/queues")

createBullBoard({
    queues:[
        new BullMQAdapter(emailQueue),
        new BullMQAdapter(printingQueue)
    ],
    serverAdapter
})

export  {serverAdapter}
