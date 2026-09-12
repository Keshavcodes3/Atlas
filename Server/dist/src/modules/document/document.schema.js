import { Schema, model } from "mongoose";
export var DocumentSourceType;
(function (DocumentSourceType) {
    DocumentSourceType["PDF"] = "pdf";
    DocumentSourceType["TEXT"] = "text";
    DocumentSourceType["MARKDOWN"] = "markdown";
    DocumentSourceType["DOCX"] = "docx";
    DocumentSourceType["CSV"] = "csv";
    DocumentSourceType["URL"] = "url";
})(DocumentSourceType || (DocumentSourceType = {}));
export var DocumentStatus;
(function (DocumentStatus) {
    DocumentStatus["PENDING"] = "pending";
    DocumentStatus["PROCESSING"] = "processing";
    DocumentStatus["READY"] = "ready";
    DocumentStatus["FAILED"] = "failed";
})(DocumentStatus || (DocumentStatus = {}));
const documentSchema = new Schema({
    workspaceId: {
        type: Schema.Types.ObjectId,
        ref: "Workspace",
        required: true,
        index: true,
    },
    uploadedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 300,
    },
    sourceType: {
        type: String,
        enum: Object.values(DocumentSourceType),
        required: true,
        index: true,
    },
    source: {
        name: {
            type: String,
            trim: true,
        },
        url: {
            type: String,
            trim: true,
        },
        mimeType: {
            type: String,
            trim: true,
        },
        size: {
            type: Number,
        },
    },
    content: {
        type: String,
    },
    chunkCount: {
        type: Number,
        default: 0,
    },
    status: {
        type: String,
        enum: Object.values(DocumentStatus),
        default: DocumentStatus.PENDING,
        index: true,
    },
    error: {
        type: String,
    },
    metadata: {
        author: String,
        description: String,
        language: String,
        pageCount: Number,
        wordCount: Number,
    },
}, {
    timestamps: true,
});
export const DocumentModel = model("Document", documentSchema);
