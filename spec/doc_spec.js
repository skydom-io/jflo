var jflo_object_doc = {
    /**
     * JFlo packet header; contains common metadata and
     * application-specific out-of-band data
     */
    "@jflo": {
        /**
         * Document type
         */
        type: "Indicates the document type",
        src: "Routing: The logical origin of the document",
        dest: "Routing: Where the document is headed",
        /**
         * User space: Standard list of document tags
         */
        tags: [
            "red",
            "green",
            "blue"
        ],
        /**
         * User space: Standard named document properties
         */
        gp: {
            "color": "red"
        },
        /**
         * Application specific properties
         */
        ap: {

        },
        /**
         * Collects the flow instances by which the document has travelled
         */
        trace: [

        ]
    },
    /* JSON payload */
    payload_field1: "Any JSON",
    payload_fieldN: "Any JSON"
}

var jflo_any_doc = {
    "@fjlo": {
        // JFlo header
    },
    "@data": "<JSON object, array, number, string, true, false or null>"
}

var jflo_flow_control_spec = {
    "@jflo": {
        type: "jflo.control_message",
        id: "<id of this message>",
        cmd: "<command_code>: set_state | set_input | set_output | set_inout | end | pause | resume",
        params: {
            param_1: "<new value>"
        },
        target: "<specifies the flow instance to be controlled>",
        src: "<specifies the originator of the control message>"
    }
}